#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// A small, media-free desktop shell: window controls, storage, settings
// migration and developer tools. Everything else lives in the frontend.

mod assets;
mod devtools;
mod link_meta;
mod media_import;
mod maintenance;
mod migrate;
mod webview_memory;
mod window_controls;

/// Set the calling webview's zoom factor (1.0 = 100%). Driven by the Settings
/// zoom slider; uses WebView2's native zoom so everything (including fixed
/// chrome) scales consistently.
#[tauri::command]
fn set_webview_zoom(window: tauri::WebviewWindow, scale: f64) -> Result<(), String> {
    let scale = scale.clamp(0.4, 2.5);
    window.set_zoom(scale).map_err(|e| e.to_string())
}

#[tauri::command]
fn desktop_platform() -> &'static str {
    std::env::consts::OS
}

fn main() {
    // Before anything reads (or creates) app data: carry over anything stored
    // under the app's previous identity, and finish any clear the running app
    // had to defer because WebView2 held its profile open.
    migrate::run();
    maintenance::run_startup_cleanup();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize(); let _ = window.show(); let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    window_controls::init_frame(&window).map_err(std::io::Error::other)?;
                }
            }
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            assets::save_asset,
            assets::prepare_export,
            assets::copy_export_files,
            assets::delete_asset,
            assets::list_assets,
            link_meta::fetch_link_meta,
            media_import::import_media_url,
            devtools::open_devtools,
            maintenance::cache_size,
            maintenance::clear_local_data,
            webview_memory::set_webview_memory_low,
            set_webview_zoom,
            desktop_platform,
            window_controls::set_linux_window_controls,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Board")
        .run(|_app, _event| {});
}
