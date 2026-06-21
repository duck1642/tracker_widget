use std::fs;
use std::time::UNIX_EPOCH;
use tauri::Manager;

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let path_buf = std::path::Path::new(&path);
    if !path_buf.exists() {
        let default_content = if path.ends_with("todo.md") {
            "- [ ] Welcome to your desktop to-do widget!\n- [ ] Double-click to edit this task.\n  - [ ] Use Tab to indent.\n  - [ ] Use Shift+Tab to outdent.\n"
        } else {
            ""
        };
        if let Some(parent) = path_buf.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&path, default_content).map_err(|e| e.to_string())?;
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let path_buf = std::path::Path::new(&path);
    if let Some(parent) = path_buf.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_default_path() -> String {
    if cfg!(debug_assertions) {
        if let Ok(cwd) = std::env::current_dir() {
            return cwd.join("todo.md").to_string_lossy().to_string();
        }
    } else if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            return parent.join("todo.md").to_string_lossy().to_string();
        }
    }
    "todo.md".to_string()
}

#[tauri::command]
fn get_file_modified_time(path: String) -> Result<u64, String> {
    fs::metadata(&path)
        .and_then(|m| m.modified())
        .map(|time| time.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_always_on_top(window: tauri::Window, on_top: bool) -> Result<(), String> {
    window.set_always_on_top(on_top).map_err(|e| e.to_string())
}


#[tauri::command]
fn log_history_entry(path: String, entry_json: String) -> Result<(), String> {
    use std::fs::OpenOptions;
    use std::io::Write;
    
    let path_buf = std::path::Path::new(&path);
    if let Some(parent) = path_buf.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
        
    writeln!(file, "{}", entry_json).map_err(|e| e.to_string())
}

#[tauri::command]
fn pop_history_entry(path: String) -> Result<String, String> {
    if !std::path::Path::new(&path).exists() {
        return Err("No history".to_string());
    }
    
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut lines: Vec<&str> = content.lines().filter(|l| !l.is_empty()).collect();
    
    if lines.is_empty() {
        return Err("No history".to_string());
    }
    
    let last_line = lines.pop().unwrap().to_string();
    
    let new_content = if lines.is_empty() {
        "".to_string()
    } else {
        lines.join("\n") + "\n"
    };
    
    fs::write(&path, new_content).map_err(|e| e.to_string())?;
    
    Ok(last_line)
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct AppConfig {
    file_path: String,
    layer_mode: String,
    drag_enabled: bool,
    autostart_enabled: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            file_path: get_default_path(),
            layer_mode: "normal".to_string(),
            drag_enabled: true,
            autostart_enabled: false,
        }
    }
}

fn get_config_path() -> std::path::PathBuf {
    if cfg!(debug_assertions) {
        if let Ok(cwd) = std::env::current_dir() {
            if cwd.ends_with("src-tauri") {
                if let Some(parent) = cwd.parent() {
                    return parent.join("config.json");
                }
            }
            return cwd.join("config.json");
        }
    } else if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            return parent.join("config.json");
        }
    }
    std::path::PathBuf::from("config.json")
}

#[tauri::command]
fn read_config() -> Result<AppConfig, String> {
    let path = get_config_path();
    if !path.exists() {
        let default_config = AppConfig::default();
        let json = serde_json::to_string_pretty(&default_config).map_err(|e| e.to_string())?;
        fs::write(&path, json).map_err(|e| e.to_string())?;
        return Ok(default_config);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let config: AppConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
fn write_config(config: AppConfig) -> Result<(), String> {
    let path = get_config_path();
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "windows")]
static mut ORIGINAL_WNDPROC: Option<unsafe extern "system" fn(
    windows_sys::Win32::Foundation::HWND,
    u32,
    windows_sys::Win32::Foundation::WPARAM,
    windows_sys::Win32::Foundation::LPARAM,
) -> windows_sys::Win32::Foundation::LRESULT> = None;

#[cfg(target_os = "windows")]
unsafe extern "system" fn subclass_wndproc(
    hwnd: windows_sys::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows_sys::Win32::Foundation::WPARAM,
    lparam: windows_sys::Win32::Foundation::LPARAM,
) -> windows_sys::Win32::Foundation::LRESULT {
    use windows_sys::Win32::UI::WindowsAndMessaging::{CallWindowProcW, WM_GETDLGCODE};
    const DLGC_WANTALLKEYS: windows_sys::Win32::Foundation::LRESULT = 0x0004;

    if msg == WM_GETDLGCODE {
        return DLGC_WANTALLKEYS;
    }

    if let Some(orig) = ORIGINAL_WNDPROC {
        CallWindowProcW(Some(orig), hwnd, msg, wparam, lparam)
    } else {
        0
    }
}

#[tauri::command]
fn set_desktop_parent(window: tauri::Window, enable: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM};
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            EnumWindows, FindWindowExW, FindWindowW, GetWindowLongPtrW,
            SendMessageTimeoutW, SetParent, SetWindowLongPtrW, SetWindowPos,
            GWL_STYLE, GWL_EXSTYLE, SMTO_NORMAL, SWP_FRAMECHANGED, SWP_NOACTIVATE,
            SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, WS_CHILD, WS_POPUP,
            WS_EX_LAYERED, GWLP_WNDPROC,
        };

        fn wide(s: &str) -> Vec<u16> {
            s.encode_utf16().chain(std::iter::once(0)).collect()
        }

        unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let shell = wide("SHELLDLL_DefView");

            let def_view = FindWindowExW(
                hwnd,
                0,
                shell.as_ptr(),
                std::ptr::null(),
            );

            if def_view != 0 {
                *(lparam as *mut HWND) = hwnd;
                return 0;
            }

            1
        }

        unsafe fn find_desktop_parent() -> HWND {
            let progman_class = wide("Progman");
            let progman = FindWindowW(progman_class.as_ptr(), std::ptr::null());

            if progman != 0 {
                let mut result = 0usize;

                // Ask Explorer to initialize WorkerW windows.
                SendMessageTimeoutW(
                    progman,
                    0x052C,
                    0,
                    0,
                    SMTO_NORMAL,
                    1000,
                    &mut result,
                );
            }

            let mut desktop_parent: HWND = 0;
            EnumWindows(
                Some(enum_windows_proc),
                &mut desktop_parent as *mut HWND as LPARAM,
            );

            if desktop_parent != 0 {
                desktop_parent
            } else {
                progman
            }
        }

        unsafe {
            let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as HWND;

            if enable {
                if (*std::ptr::addr_of!(ORIGINAL_WNDPROC)).is_none() {
                    let parent = find_desktop_parent();

                    if parent == 0 {
                        return Err("Could not find desktop parent window".to_string());
                    }

                    let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
                    let new_style = (style & !WS_POPUP) | WS_CHILD;

                    let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
                    let new_ex_style = ex_style | WS_EX_LAYERED;

                    SetWindowLongPtrW(hwnd, GWL_STYLE, new_style as isize);
                    SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex_style as isize);
                    SetParent(hwnd, parent);

                    // Subclass the window to intercept WM_GETDLGCODE and handle Tab keys correctly.
                    let original = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, subclass_wndproc as *const () as isize);
                    if original == 0 {
                        return Err("Failed to subclass window".to_string());
                    }
                    ORIGINAL_WNDPROC = Some(std::mem::transmute(original));
                }

                SetWindowPos(
                    hwnd,
                    0,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE
                        | SWP_NOSIZE
                        | SWP_NOACTIVATE
                        | SWP_SHOWWINDOW
                        | SWP_FRAMECHANGED,
                );
            } else {
                // Restore original window procedure before restoring styles
                if let Some(orig) = ORIGINAL_WNDPROC {
                    SetWindowLongPtrW(hwnd, GWLP_WNDPROC, orig as isize);
                    ORIGINAL_WNDPROC = None;
                }

                SetParent(hwnd, 0);

                let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
                let new_style = (style & !WS_CHILD) | WS_POPUP;

                let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
                let new_ex_style = ex_style & !WS_EX_LAYERED;

                SetWindowLongPtrW(hwnd, GWL_STYLE, new_style as isize);
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex_style as isize);

                SetWindowPos(
                    hwnd,
                    0,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE
                        | SWP_NOSIZE
                        | SWP_NOACTIVATE
                        | SWP_SHOWWINDOW
                        | SWP_FRAMECHANGED,
                );
            }
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = window;
        let _ = enable;
        Ok(())
    }
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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

            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).map_err(|e| e.to_string())?;
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>).map_err(|e| e.to_string())?;
            let menu = Menu::with_items(app, &[&show, &quit]).map_err(|e| e.to_string())?;

            if let Some(icon) = app.default_window_icon() {
                let _tray = TrayIconBuilder::new()
                    .icon(icon.clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click { button, button_state, .. } = event {
                            if button == tauri::tray::MouseButton::Left && button_state == tauri::tray::MouseButtonState::Up {
                                let app = tray.app_handle();
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    })
                    .on_menu_event(|app: &tauri::AppHandle, event: tauri::menu::MenuEvent| match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
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
            log_history_entry,
            pop_history_entry,
            set_desktop_parent,
            read_config,
            write_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

