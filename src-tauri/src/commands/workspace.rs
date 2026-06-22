use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

const DAILY_TEMPLATE: &str = include_str!("../../../templates/daily-log.md");
const WEEKLY_TEMPLATE: &str = include_str!("../../../templates/weekly-index.md");

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogDayEntry {
    name: String,
    path: String,
    date: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogWeekEntry {
    name: String,
    path: String,
    index_path: Option<String>,
    days: Vec<LogDayEntry>,
}

fn is_week_name(name: &str) -> bool {
    name.len() == 7
        && name.as_bytes()[..4].iter().all(u8::is_ascii_digit)
        && name.as_bytes()[4] == b'w'
        && name.as_bytes()[5..].iter().all(u8::is_ascii_digit)
}

fn daily_date(name: &str) -> Option<String> {
    if name.len() == 15
        && name.ends_with("_log.md")
        && name.as_bytes()[..8].iter().all(u8::is_ascii_digit)
    {
        Some(format!("{}-{}-{}", &name[0..4], &name[4..6], &name[6..8]))
    } else {
        None
    }
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).is_dir()
}

#[tauri::command]
pub fn list_log_tree(root_path: String) -> Result<Vec<LogWeekEntry>, String> {
    let root = Path::new(&root_path);
    if !root.is_dir() {
        return Err("Logs folder unavailable".to_string());
    }
    let mut weeks = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !entry.path().is_dir() || !is_week_name(&name) {
            continue;
        }
        let mut days = Vec::new();
        let index = entry.path().join(format!("{name}_index.md"));
        for child in fs::read_dir(entry.path()).map_err(|error| error.to_string())? {
            let child = child.map_err(|error| error.to_string())?;
            let child_name = child.file_name().to_string_lossy().to_string();
            if let Some(date) = daily_date(&child_name) {
                days.push(LogDayEntry {
                    name: child_name,
                    path: display_path(&child.path()),
                    date,
                });
            }
        }
        days.sort_by(|left, right| left.date.cmp(&right.date));
        weeks.push(LogWeekEntry {
            name,
            path: display_path(&entry.path()),
            index_path: index.exists().then(|| display_path(&index)),
            days,
        });
    }
    weeks.sort_by(|left, right| right.name.cmp(&left.name));
    Ok(weeks)
}

fn template_dir() -> PathBuf {
    super::config::get_config_path()
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("templates")
}

fn ensure_templates() -> Result<(PathBuf, PathBuf), String> {
    let dir = template_dir();
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let daily = dir.join("daily-log.md");
    let weekly = dir.join("weekly-index.md");
    if !daily.exists() {
        fs::write(&daily, DAILY_TEMPLATE).map_err(|error| error.to_string())?;
    }
    if !weekly.exists() {
        fs::write(&weekly, WEEKLY_TEMPLATE).map_err(|error| error.to_string())?;
    }
    Ok((daily, weekly))
}

fn fill_template(template: &str, values: &[(&str, String)]) -> String {
    values
        .iter()
        .fold(template.to_string(), |output, (key, value)| {
            output.replace(&format!("{{{{{key}}}}}"), value)
        })
}

fn write_new(path: &Path, content: &str) -> Result<bool, String> {
    match OpenOptions::new().write(true).create_new(true).open(path) {
        Ok(mut file) => {
            file.write_all(content.as_bytes())
                .map_err(|error| error.to_string())?;
            Ok(true)
        }
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn create_log_week(
    root_path: String,
    year: u32,
    week: u32,
    start_date: String,
    range_label: String,
    dates: Vec<String>,
    missing_only: bool,
) -> Result<Vec<String>, String> {
    let _ = missing_only;
    if !(1..=53).contains(&week)
        || dates.len() != 7
        || dates.iter().any(|date| {
            date.len() != 10
                || date.as_bytes()[4] != b'-'
                || date.as_bytes()[7] != b'-'
                || date
                    .bytes()
                    .enumerate()
                    .any(|(index, byte)| index != 4 && index != 7 && !byte.is_ascii_digit())
        })
    {
        return Err("Invalid ISO week creation request".to_string());
    }
    let root = Path::new(&root_path);
    if !root.is_dir() {
        return Err("Logs folder unavailable".to_string());
    }
    let folder_name = format!("{year}w{week:02}");
    let week_dir = root.join(&folder_name);
    fs::create_dir_all(&week_dir).map_err(|error| error.to_string())?;
    let (daily_path, weekly_path) = ensure_templates()?;
    let daily_template = fs::read_to_string(daily_path).map_err(|error| error.to_string())?;
    let weekly_template = fs::read_to_string(weekly_path).map_err(|error| error.to_string())?;
    let mut created = Vec::new();
    let index_path = week_dir.join(format!("{folder_name}_index.md"));
    let weekly = fill_template(
        &weekly_template,
        &[
            ("title", format!("{folder_name}_index")),
            ("date", start_date.clone()),
            ("week_year", year.to_string()),
            ("week", week.to_string()),
            ("week_range", range_label),
        ],
    );
    if write_new(&index_path, &weekly)? {
        created.push(display_path(&index_path));
    }
    for date in dates {
        let compact = date.replace('-', "");
        let path = week_dir.join(format!("{compact}_log.md"));
        let daily = fill_template(
            &daily_template,
            &[("title", format!("{compact}_log")), ("date", date)],
        );
        if write_new(&path, &daily)? {
            created.push(display_path(&path));
        }
    }
    Ok(created)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_directory(label: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("tracker-widget-{label}-{stamp}"));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn week_dates() -> Vec<String> {
        (22..=28).map(|day| format!("2026-06-{day:02}")).collect()
    }

    #[test]
    fn recognizes_only_supported_log_names() {
        assert!(is_week_name("2026w25"));
        assert!(!is_week_name("week25"));
        assert_eq!(daily_date("20260622_log.md").as_deref(), Some("2026-06-22"));
        assert_eq!(daily_date("notes.md"), None);
    }

    #[test]
    fn fills_known_template_placeholders() {
        assert_eq!(
            fill_template(
                "{{date}}/{{title}}",
                &[("date", "2026-06-22".into()), ("title", "day".into())]
            ),
            "2026-06-22/day"
        );
    }

    #[test]
    fn create_new_never_overwrites() {
        let path = std::env::temp_dir().join(format!(
            "tracker-widget-{}-create-new.md",
            std::process::id()
        ));
        let _ = fs::remove_file(&path);
        assert!(write_new(&path, "first").unwrap());
        assert!(!write_new(&path, "second").unwrap());
        assert_eq!(fs::read_to_string(&path).unwrap(), "first");
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn repairs_only_missing_week_files() {
        let root = temp_directory("week-repair");
        let created = create_log_week(
            display_path(&root),
            2026,
            26,
            "2026-06-22".into(),
            "June 22-28".into(),
            week_dates(),
            false,
        )
        .unwrap();
        assert_eq!(created.len(), 8);
        let index = root.join("2026w26").join("2026w26_index.md");
        fs::write(&index, "keep me").unwrap();
        let missing = root.join("2026w26").join("20260625_log.md");
        fs::remove_file(&missing).unwrap();

        let repaired = create_log_week(
            display_path(&root),
            2026,
            26,
            "2026-06-22".into(),
            "June 22-28".into(),
            week_dates(),
            true,
        )
        .unwrap();

        assert_eq!(repaired, vec![display_path(&missing)]);
        assert_eq!(fs::read_to_string(index).unwrap(), "keep me");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_incomplete_week_requests() {
        let root = temp_directory("invalid-week");
        let result = create_log_week(
            display_path(&root),
            2026,
            54,
            "2026-06-22".into(),
            "invalid".into(),
            vec!["2026-06-22".into()],
            false,
        );
        assert!(result.is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
