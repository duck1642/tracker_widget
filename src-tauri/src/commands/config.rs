use std::fs;

pub const FRONTMATTER_OFF: &str = "off";
pub const FRONTMATTER_PERSONAL: &str = "personal";

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub struct AppConfig {
    pub file_path: String,
    #[serde(default)]
    pub logs_root_path: String,
    pub layer_mode: String,
    pub drag_enabled: bool,
    pub autostart_enabled: bool,
    #[serde(default = "default_frontmatter_mode")]
    pub frontmatter_mode: String,
    #[serde(default)]
    pub developer_mode: bool,
}

pub fn default_frontmatter_mode() -> String {
    FRONTMATTER_OFF.to_string()
}

pub fn normalize_frontmatter_mode(mode: &str) -> String {
    match mode {
        FRONTMATTER_PERSONAL => FRONTMATTER_PERSONAL.to_string(),
        _ => FRONTMATTER_OFF.to_string(),
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            file_path: String::new(),
            logs_root_path: String::new(),
            layer_mode: "normal".to_string(),
            drag_enabled: true,
            autostart_enabled: false,
            frontmatter_mode: default_frontmatter_mode(),
            developer_mode: false,
        }
    }
}

impl AppConfig {
    fn normalized(mut self) -> Self {
        self.frontmatter_mode = normalize_frontmatter_mode(&self.frontmatter_mode);
        self
    }
}

pub fn get_config_path() -> std::path::PathBuf {
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
pub fn read_config() -> Result<AppConfig, String> {
    let path = get_config_path();
    if !path.exists() {
        let default_config = AppConfig::default();
        let json = serde_json::to_string_pretty(&default_config).map_err(|e| e.to_string())?;
        fs::write(&path, json).map_err(|e| e.to_string())?;
        return Ok(default_config);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let config: AppConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(config.normalized())
}

#[tauri::command]
pub fn write_config(config: AppConfig) -> Result<(), String> {
    let path = get_config_path();
    let json = serde_json::to_string_pretty(&config.normalized()).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn example_config_matches_first_run_defaults() {
        let example: AppConfig =
            serde_json::from_str(include_str!("../../../config.example.json")).unwrap();

        assert_eq!(example, AppConfig::default());
    }

    #[test]
    fn missing_or_unknown_frontmatter_mode_defaults_off() {
        let missing: AppConfig = serde_json::from_str(
            r#"{"file_path":"","logs_root_path":"","layer_mode":"normal","drag_enabled":true,"autostart_enabled":false}"#,
        )
        .unwrap();
        assert_eq!(missing.normalized().frontmatter_mode, FRONTMATTER_OFF);

        let unknown: AppConfig = serde_json::from_str(
            r#"{"file_path":"","logs_root_path":"","layer_mode":"normal","drag_enabled":true,"autostart_enabled":false,"frontmatter_mode":"weird"}"#,
        )
        .unwrap();
        assert_eq!(unknown.normalized().frontmatter_mode, FRONTMATTER_OFF);
    }
}
