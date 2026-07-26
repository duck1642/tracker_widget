mod commands;

use commands::config::{read_config, write_config};
use commands::fs::{get_file_modified_time, read_file, write_file};
use commands::session_history::{read_session_history, rebuild_session_history, record_sessions};
use commands::subject_history::{read_subject_history, rebuild_subject_history, record_subjects};
use commands::window::{exit_app, set_always_on_top, toggle_devtools};
use commands::workspace::{
    convert_week_to_personal, create_log_week, create_workspace_todo, import_workspace_todo,
    list_log_tree, path_exists, recycle_week,
};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
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
            get_file_modified_time,
            set_always_on_top,
            exit_app,
            toggle_devtools,
            read_config,
            write_config,
            read_subject_history,
            rebuild_subject_history,
            record_subjects,
            read_session_history,
            rebuild_session_history,
            record_sessions,
            path_exists,
            list_log_tree,
            create_log_week,
            convert_week_to_personal,
            recycle_week,
            create_workspace_todo,
            import_workspace_todo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod capability_tests {
    #[test]
    fn main_window_can_show_confirmation_dialogs() {
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../capabilities/default.json"))
                .expect("default capability must be valid JSON");
        let permissions = capability["permissions"]
            .as_array()
            .expect("default capability must list permissions");

        assert!(
            permissions
                .iter()
                .any(|permission| permission.as_str() == Some("dialog:allow-message")),
            "week deletion confirmation requires dialog:allow-message"
        );
    }
}
