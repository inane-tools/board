//! Download direct media without browser CORS restrictions or buffering whole videos.
use std::{sync::atomic::{AtomicU64, Ordering}, time::{Duration, SystemTime, UNIX_EPOCH}};
use serde::Serialize;
use tauri::{AppHandle, Manager};
use tokio::io::AsyncWriteExt;
static COUNTER: AtomicU64 = AtomicU64::new(0);
const LIMIT: u64 = 250 * 1024 * 1024;
#[derive(Serialize)]
pub struct ImportedMedia { path: String, size: u64, mime: String }
fn media_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { return Some("image/png"); }
    if bytes.starts_with(b"\xff\xd8\xff") { return Some("image/jpeg"); }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") { return Some("image/gif"); }
    if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") { return Some("image/webp"); }
    if bytes.starts_with(b"BM") { return Some("image/bmp"); }
    if bytes.get(4..8) == Some(b"ftyp") {
        if bytes.get(8..12) == Some(b"avif") || bytes.get(8..12) == Some(b"avis") { return Some("image/avif"); }
        return Some("video/mp4");
    }
    if bytes.starts_with(b"\x1a\x45\xdf\xa3") { return Some("video/webm"); }
    if bytes.starts_with(b"OggS") { return Some("video/ogg"); }
    None
}
#[tauri::command]
pub async fn import_media_url(app: AppHandle, url: String) -> Result<ImportedMedia, String> {
    let url = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    if !matches!(url.scheme(), "http" | "https") || !url.username().is_empty() || url.password().is_some() { return Err("Only HTTP(S) media URLs are supported".into()); }
    let client = reqwest::Client::builder().timeout(Duration::from_secs(90)).connect_timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::limited(5)).build().map_err(|e| e.to_string())?;
    let mut response = client.get(url).send().await.map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?;
    if response.content_length().unwrap_or(0) > LIMIT { return Err("Media downloads are limited to 250 MB".into()); }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("assets");
    tokio::fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let base = format!("remote-{stamp}-{}", COUNTER.fetch_add(1, Ordering::Relaxed));
    let partial = dir.join(format!("{base}.part"));
    let result: Result<ImportedMedia, String> = async {
        let mut file = tokio::fs::File::create(&partial).await.map_err(|e| e.to_string())?;
        let mut size = 0;
        let mut prefix = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
            size += chunk.len() as u64;
            if size > LIMIT { return Err("Media downloads are limited to 250 MB".into()); }
            let count = chunk.len().min(512usize.saturating_sub(prefix.len())); prefix.extend_from_slice(&chunk[..count]);
            file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        }
        file.flush().await.map_err(|e| e.to_string())?;
        drop(file);
        let mime = media_type(&prefix).ok_or("The URL did not return a supported image or video")?;
        let extension = match mime { "image/png" => "png", "image/jpeg" => "jpg", "image/gif" => "gif", "image/webp" => "webp", "image/bmp" => "bmp", "image/avif" => "avif", "video/webm" => "webm", "video/ogg" => "ogv", _ => "mp4" };
        let output = dir.join(format!("{base}.{extension}"));
        tokio::fs::rename(&partial, &output).await.map_err(|e| e.to_string())?;
        Ok(ImportedMedia { path: output.to_string_lossy().to_string(), size, mime: mime.into() })
    }.await;
    if result.is_err() { let _ = tokio::fs::remove_file(&partial).await; }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn detects_images_and_gifs_without_trusting_url_extension() {
        assert_eq!(media_type(b"GIF89a123"), Some("image/gif"));
        assert_eq!(media_type(b"\x89PNG\r\n\x1a\nrest"), Some("image/png"));
        assert_eq!(media_type(b"<html>not an image</html>"), None);
        assert_eq!(media_type(b""), None);
    }
    #[test] fn distinguishes_avif_and_video_containers() {
        assert_eq!(media_type(b"0000ftypavif"), Some("image/avif"));
        assert_eq!(media_type(b"0000ftypisom"), Some("video/mp4"));
        assert_eq!(media_type(b"\x1a\x45\xdf\xa3webm"), Some("video/webm"));
    }
}
