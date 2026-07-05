#[tauri::command]
pub fn set_always_on_top(window: tauri::Window, on_top: bool) -> Result<(), String> {
    window.set_always_on_top(on_top).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    use tauri::Manager;
    for window in app.webview_windows().values() {
        let _ = window.destroy();
    }
    app.exit(0);
}

#[tauri::command]
pub fn toggle_devtools(window: tauri::WebviewWindow) {
    if window.is_devtools_open() {
        let _ = window.close_devtools();
    } else {
        let _ = window.open_devtools();
    }
}
