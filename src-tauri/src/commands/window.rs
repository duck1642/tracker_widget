#[tauri::command]
pub fn set_always_on_top(window: tauri::Window, on_top: bool) -> Result<(), String> {
    window.set_always_on_top(on_top).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg(target_os = "windows")]
static mut ORIGINAL_WNDPROC: Option<
    unsafe extern "system" fn(
        windows_sys::Win32::Foundation::HWND,
        u32,
        windows_sys::Win32::Foundation::WPARAM,
        windows_sys::Win32::Foundation::LPARAM,
    ) -> windows_sys::Win32::Foundation::LRESULT,
> = None;

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
pub fn set_desktop_parent(window: tauri::Window, enable: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM};
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            EnumWindows, FindWindowExW, FindWindowW, GetWindowLongPtrW, SendMessageTimeoutW,
            SetParent, SetWindowLongPtrW, SetWindowPos, GWLP_WNDPROC, GWL_EXSTYLE, GWL_STYLE,
            SMTO_NORMAL, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW,
            WS_CHILD, WS_EX_LAYERED, WS_POPUP,
        };

        fn wide(s: &str) -> Vec<u16> {
            s.encode_utf16().chain(std::iter::once(0)).collect()
        }

        unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let shell = wide("SHELLDLL_DefView");

            let def_view = FindWindowExW(hwnd, 0, shell.as_ptr(), std::ptr::null());

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
                SendMessageTimeoutW(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, &mut result);
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
                    let original = SetWindowLongPtrW(
                        hwnd,
                        GWLP_WNDPROC,
                        subclass_wndproc as *const () as isize,
                    );
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
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
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
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
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
