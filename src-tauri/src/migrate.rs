//! App data location helper.
//!
//! Kept separate from the Tauri builder so `main()` can resolve the data
//! directory (for the startup clear) before any window exists.

use std::path::PathBuf;

#[cfg(not(target_os = "linux"))]
pub const NEW_IDENTIFIER: &str = "com.journal.app";
#[cfg(target_os = "linux")]
pub const NEW_IDENTIFIER: &str = "com.journal.app";

/// The app-data directory Tauri resolves `BaseDirectory::AppData` to, which is
/// where `tauri-plugin-store` keeps relative paths.
#[cfg(target_os = "windows")]
pub fn app_data_dir(identifier: &str) -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|dir| PathBuf::from(dir).join(identifier))
}

#[cfg(target_os = "macos")]
pub fn app_data_dir(identifier: &str) -> Option<PathBuf> {
    std::env::var_os("HOME").map(|dir| {
        PathBuf::from(dir)
            .join("Library")
            .join("Application Support")
            .join(identifier)
    })
}

#[cfg(all(unix, not(target_os = "macos")))]
pub fn app_data_dir(identifier: &str) -> Option<PathBuf> {
    std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|dir| PathBuf::from(dir).join(".local/share")))
        .map(|dir| dir.join(identifier))
}

/// No-op kept for the startup call site. There is no legacy identity to migrate
/// from in a fresh application.
pub fn run() {}
