//! Link previews.
//!
//! Fetch a page and pull its OpenGraph / Twitter card metadata so link items on
//! a board can render a rich preview. Runs in Rust because the webview cannot
//! fetch arbitrary cross-origin pages.

use std::collections::HashMap;
use std::time::Duration;

use regex::Regex;
use serde::Serialize;

#[derive(Serialize, Default)]
pub struct LinkMeta {
    pub title: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
    pub site: Option<String>,
}

fn clean(value: &str) -> String {
    let decoded = value
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ");
    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[tauri::command]
pub async fn fetch_link_meta(url: String) -> Result<LinkMeta, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        )
        .build()
        .map_err(|e| e.to_string())?;

    let base = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    if !matches!(base.scheme(), "http" | "https") { return Err("Only HTTP links are supported".into()); }
    let mut response = client.get(base.clone()).send().await.map_err(|e| e.to_string())?
        .error_for_status().map_err(|e| e.to_string())?;
    let final_url = response.url().clone();
    let mut bytes = Vec::new();
    const LIMIT: usize = 500_000;
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        let count = chunk.len().min(LIMIT - bytes.len());
        bytes.extend_from_slice(&chunk[..count]);
        if bytes.len() == LIMIT { break; }
    }
    let html = String::from_utf8_lossy(&bytes);

    let meta_re = Regex::new(r"(?is)<meta\b[^>]*>").map_err(|e| e.to_string())?;
    let attr_re = Regex::new(r#"(?is)([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))"#)
        .map_err(|e| e.to_string())?;

    let mut meta = LinkMeta::default();
    let mut twitter_image: Option<String> = None;

    for tag in meta_re.find_iter(&html) {
        let mut attrs: HashMap<String, String> = HashMap::new();
        for cap in attr_re.captures_iter(tag.as_str()) {
            let key = cap[1].to_ascii_lowercase();
            let value = cap
                .get(2)
                .or_else(|| cap.get(3))
                .or_else(|| cap.get(4))
                .map(|m| m.as_str().to_string())
                .unwrap_or_default();
            attrs.insert(key, value);
        }
        let key = attrs
            .get("property")
            .or_else(|| attrs.get("name"))
            .map(|s| s.to_ascii_lowercase())
            .unwrap_or_default();
        let content = attrs.get("content").cloned().unwrap_or_default();
        if content.is_empty() {
            continue;
        }
        match key.as_str() {
            "og:title" => meta.title = Some(clean(&content)),
            "og:description" => meta.description = Some(clean(&content)),
            "og:site_name" => meta.site = Some(clean(&content)),
            "og:image" | "og:image:url" | "og:image:secure_url" => {
                if meta.image.is_none() {
                    meta.image = Some(content.clone());
                }
            }
            "twitter:image" | "twitter:image:src" => twitter_image = Some(content.clone()),
            "twitter:title" => {
                if meta.title.is_none() {
                    meta.title = Some(clean(&content));
                }
            }
            "twitter:description" | "description" => {
                if meta.description.is_none() {
                    meta.description = Some(clean(&content));
                }
            }
            _ => {}
        }
    }

    if meta.image.is_none() {
        meta.image = twitter_image;
    }
    if meta.title.is_none() {
        if let Ok(title_re) = Regex::new(r"(?is)<title[^>]*>(.*?)</title>") {
            if let Some(cap) = title_re.captures(&html) {
                meta.title = Some(clean(&cap[1]));
            }
        }
    }
    if meta.site.is_none() {
        meta.site = final_url.host_str().map(|h| h.trim_start_matches("www.").to_string());
    }
    if let Some(image) = meta.image.clone() {
        if let Ok(resolved) = final_url.join(&image) {
            meta.image = Some(resolved.to_string());
        }
    }

    Ok(meta)
}
