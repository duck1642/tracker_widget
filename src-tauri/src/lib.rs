mod commands;

use commands::config::{read_config, write_config};
use commands::fs::{get_default_path, get_file_modified_time, read_file, write_file};
use commands::window::{exit_app, set_always_on_top, set_desktop_parent};
use commands::workspace::{apply_log_migration, create_log_week, list_log_tree, path_exists};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--silent"]),
        ))
        .setup(|app| {
            // Handle --silent flag to start hidden
            let args: Vec<String> = std::env::args().collect();
            if args.contains(&"--silent".to_string()) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            // Setup System Tray
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::TrayIconBuilder;

            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let menu = Menu::with_items(app, &[&show, &quit]).map_err(|e| e.to_string())?;

            if let Some(icon) = app.default_window_icon() {
                let _tray = TrayIconBuilder::new()
                    .icon(icon.clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click {
                            button,
                            button_state,
                            ..
                        } = event
                        {
                            if button == tauri::tray::MouseButton::Left
                                && button_state == tauri::tray::MouseButtonState::Up
                            {
                                let app = tray.app_handle();
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    })
                    .on_menu_event(|app: &tauri::AppHandle, event: tauri::menu::MenuEvent| {
                        match event.id.as_ref() {
                            "quit" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                                let _ = app.emit("request-quit", ());
                            }
                            "show" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            _ => {}
                        }
                    })
                    .build(app)
                    .map_err(|e: tauri::Error| e.to_string())?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            get_default_path,
            get_file_modified_time,
            set_always_on_top,
            set_desktop_parent,
            exit_app,
            read_config,
            write_config,
            path_exists,
            list_log_tree,
            create_log_week,
            apply_log_migration
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
