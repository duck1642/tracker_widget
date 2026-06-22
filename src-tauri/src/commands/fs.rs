use std::fs;
use std::time::UNIX_EPOCH;

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
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
pub fn write_file(path: String, content: String) -> Result<(), String> {
    let path_buf = std::path::Path::new(&path);
    if let Some(parent) = path_buf.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_default_path() -> String {
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
pub fn get_file_modified_time(path: String) -> Result<u64, String> {
    fs::metadata(&path)
        .and_then(|m| m.modified())
        .map(|time| {
            time.duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        })
        .map_err(|e| e.to_string())
}
