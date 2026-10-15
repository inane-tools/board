//! Board file storage.
//!
//! Files dropped on (or pasted into) a board are written to the app data
//! directory under `assets/` and served to the webview through the asset
//! protocol. Keeping the bytes on disk (rather than inline in the library
//! document) means audio, video and large files stay usable without bloating
//! the JSON store.

use std::fs;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use tauri::{AppHandle, Manager};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn sanitize(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || "._- ".contains(c) { c } else { '_' })
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        "file".to_string()
    } else {
        trimmed.chars().take(80).collect()
    }
}

/// Write a base64 payload to `assets/` and return the absolute path.
#[tauri::command]
pub fn save_asset(app: AppHandle, name: String, data: String) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("assets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let filename = format!("{nanos:x}-{n}-{}", sanitize(&name));

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| format!("invalid data: {e}"))?;

    let path = dir.join(filename);
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn remove_owned_asset(dir: &std::path::Path, path: &std::path::Path) -> Result<(), String> {
    let root = dir.canonicalize().map_err(|e| e.to_string())?;
    let candidate = path.canonicalize().map_err(|e| e.to_string())?;
    if candidate.parent() != Some(root.as_path()) || !candidate.is_file() {
        return Err("Only files in Board's assets directory can be removed".into());
    }
    fs::remove_file(candidate).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_asset(app: AppHandle, path: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("assets");
    remove_owned_asset(&dir, std::path::Path::new(&path))
}

/// Every file currently stored in `assets/` (absolute paths).
#[tauri::command]
pub fn list_assets(app: AppHandle) -> Result<Vec<String>, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("assets");
    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                out.push(path.to_string_lossy().to_string());
            }
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deletion_cannot_escape_asset_directory() {
        let base = std::env::temp_dir().join(format!("board-assets-{}", COUNTER.fetch_add(1, Ordering::Relaxed)));
        let assets = base.join("assets"); fs::create_dir_all(&assets).unwrap();
        let outside = base.join("keep.txt"); fs::write(&outside, "keep").unwrap();
        let inside = assets.join("image.png"); fs::write(&inside, "image").unwrap();
        assert!(remove_owned_asset(&assets, &outside).is_err());
        assert!(outside.exists());
        assert!(remove_owned_asset(&assets, &inside).is_ok());
        fs::remove_dir_all(base).unwrap();
    }
}

/// Prepare a named copy without moving or exposing the app's original asset.
#[tauri::command]
pub async fn prepare_export(app: AppHandle, name: String, path: Option<String>, data: Option<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let id = COUNTER.fetch_add(1, Ordering::Relaxed);
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
        let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("exports").join(format!("{stamp}-{id}"));
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let name = sanitize(&name);
        let name = if name == "." || name == ".." { "file".to_string() } else { name };
        let output = dir.join(name);
        if let Some(path) = path {
            let root = app.path().app_data_dir().map_err(|e| e.to_string())?.join("assets").canonicalize().map_err(|e| e.to_string())?;
            let source = std::path::PathBuf::from(path).canonicalize().map_err(|e| e.to_string())?;
            if source.parent() != Some(root.as_path()) { return Err("Only Board assets can be exported".into()); }
            fs::copy(source, &output).map_err(|e| e.to_string())?;
        } else {
            let bytes = base64::engine::general_purpose::STANDARD.decode(data.ok_or("Export data is missing")?).map_err(|e| e.to_string())?;
            fs::write(&output, bytes).map_err(|e| e.to_string())?;
        }
        Ok(output.to_string_lossy().to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn copy_export_files(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    let root = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("exports").canonicalize().map_err(|e| e.to_string())?;
    if paths.is_empty() { return Err("No files selected".into()); }
    for path in &paths {
        let candidate = std::path::PathBuf::from(path).canonicalize().map_err(|e| e.to_string())?;
        if !candidate.starts_with(&root) || !candidate.is_file() { return Err("Only prepared Board exports can be copied".into()); }
    }
    #[cfg(target_os = "windows")]
    {
        use clipboard_win::Setter;
        let _clipboard = clipboard_win::Clipboard::new_attempts(10).map_err(|e| e.to_string())?;
        clipboard_win::formats::FileList.write_clipboard(paths.as_slice()).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    { Err("File copying currently supports Windows only".into()) }
}
