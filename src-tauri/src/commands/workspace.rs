use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

const DAILY_NO_FRONTMATTER_TEMPLATE: &str =
    include_str!("../../../templates/daily-log.no-frontmatter.md");
const WEEKLY_NO_FRONTMATTER_TEMPLATE: &str =
    include_str!("../../../templates/weekly-index.no-frontmatter.md");
const DAILY_PERSONAL_TEMPLATE: &str = include_str!("../../../templates/daily-log.personal.md");
const WEEKLY_PERSONAL_TEMPLATE: &str = include_str!("../../../templates/weekly-index.personal.md");
const TODO_STARTER: &str = "- [ ] Welcome to your desktop todo widget!\n- [ ] Double-click to edit this todo.\n  - [ ] Use Tab to indent.\n  - [ ] Use Shift+Tab to outdent.\n";

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoImportSummary {
    path: String,
    todo_count: usize,
    raw_line_count: usize,
    replaced: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonalConversionSummary {
    converted: usize,
    already_personal: usize,
    skipped_custom_frontmatter: usize,
}

fn is_week_name(name: &str) -> bool {
    name.len() == 7
        && name.as_bytes()[..4].iter().all(u8::is_ascii_digit)
        && name.as_bytes()[4] == b'w'
        && name.as_bytes()[5..].iter().all(u8::is_ascii_digit)
}

fn is_mutable_week_name(name: &str) -> bool {
    is_week_name(name)
        && name[5..]
            .parse::<u32>()
            .is_ok_and(|week| (1..=53).contains(&week))
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

fn resolve_week_dir(root_path: &str, week_name: &str) -> Result<PathBuf, String> {
    if !is_mutable_week_name(week_name) {
        return Err("Invalid week folder".to_string());
    }
    let root =
        fs::canonicalize(root_path).map_err(|_| "Workspace folder unavailable".to_string())?;
    if !root.is_dir() {
        return Err("Workspace folder unavailable".to_string());
    }
    let requested = root.join(week_name);
    let metadata =
        fs::symlink_metadata(&requested).map_err(|_| "Week folder unavailable".to_string())?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Invalid week folder".to_string());
    }
    let resolved =
        fs::canonicalize(&requested).map_err(|_| "Week folder unavailable".to_string())?;
    if resolved.parent() != Some(root.as_path()) {
        return Err("Week folder is outside the workspace".to_string());
    }
    Ok(resolved)
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

fn todo_path(root_path: &str) -> Result<PathBuf, String> {
    let root = Path::new(root_path);
    if !root.is_dir() {
        return Err("Workspace folder unavailable".to_string());
    }
    Ok(root.join("todo.md"))
}

fn todo_counts(content: &str) -> (usize, usize) {
    let mut todo_count = 0;
    let mut raw_line_count = 0;
    for line in content.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("- [ ] ")
            || trimmed.starts_with("- [x] ")
            || trimmed.starts_with("- [X] ")
        {
            todo_count += 1;
        } else if !trimmed.is_empty() {
            raw_line_count += 1;
        }
    }
    (todo_count, raw_line_count)
}

#[tauri::command]
pub fn create_workspace_todo(root_path: String) -> Result<TodoImportSummary, String> {
    let path = todo_path(&root_path)?;
    if write_new(&path, TODO_STARTER)? {
        let (todo_count, raw_line_count) = todo_counts(TODO_STARTER);
        Ok(TodoImportSummary {
            path: display_path(&path),
            todo_count,
            raw_line_count,
            replaced: false,
        })
    } else {
        Err("todo.md already exists".to_string())
    }
}

#[tauri::command]
pub fn import_workspace_todo(
    root_path: String,
    source_path: String,
    replace: bool,
) -> Result<TodoImportSummary, String> {
    let destination = todo_path(&root_path)?;
    if destination.exists() && !replace {
        return Err("todo.md already exists".to_string());
    }
    let source = Path::new(&source_path);
    if !source.is_file() {
        return Err("Selected Markdown file is unavailable".to_string());
    }
    if !source
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
    {
        return Err("Select a Markdown file".to_string());
    }
    let content = fs::read_to_string(source).map_err(|error| error.to_string())?;
    let replaced = destination.exists();
    fs::write(&destination, &content).map_err(|error| error.to_string())?;
    let (todo_count, raw_line_count) = todo_counts(&content);
    Ok(TodoImportSummary {
        path: display_path(&destination),
        todo_count,
        raw_line_count,
        replaced,
    })
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

fn ensure_templates_in_dir(dir: &Path) -> Result<(), String> {
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let templates = [
        ("daily-log.no-frontmatter.md", DAILY_NO_FRONTMATTER_TEMPLATE),
        (
            "weekly-index.no-frontmatter.md",
            WEEKLY_NO_FRONTMATTER_TEMPLATE,
        ),
        ("daily-log.personal.md", DAILY_PERSONAL_TEMPLATE),
        ("weekly-index.personal.md", WEEKLY_PERSONAL_TEMPLATE),
    ];
    for (name, content) in templates {
        let path = dir.join(name);
        if !path.exists() {
            fs::write(path, content).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn ensure_templates() -> Result<(), String> {
    ensure_templates_in_dir(&template_dir())
}

fn template_paths(frontmatter_mode: &str) -> Result<(PathBuf, PathBuf), String> {
    ensure_templates()?;
    let dir = template_dir();
    let mode = super::config::normalize_frontmatter_mode(frontmatter_mode);
    let suffix = if mode == super::config::FRONTMATTER_PERSONAL {
        "personal"
    } else {
        "no-frontmatter"
    };
    Ok((
        dir.join(format!("daily-log.{suffix}.md")),
        dir.join(format!("weekly-index.{suffix}.md")),
    ))
}

fn fill_template(template: &str, values: &[(&str, String)]) -> String {
    values
        .iter()
        .fold(template.to_string(), |output, (key, value)| {
            output.replace(&format!("{{{{{key}}}}}"), value)
        })
}

fn daily_title(date: &str, day_index: usize) -> String {
    let month = date
        .get(5..7)
        .and_then(|value| value.parse::<usize>().ok())
        .and_then(|month| {
            [
                "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
            ]
            .get(month.saturating_sub(1))
        })
        .copied()
        .unwrap_or("date");
    let day = date.get(8..10).unwrap_or("00");
    let weekday = ["mon", "tue", "wed", "thur", "fri", "sat", "sun"]
        .get(day_index)
        .copied()
        .unwrap_or("day");
    format!("{month}{day}_{weekday}_log")
}

fn weekday_for_date(date: &str) -> Option<&'static str> {
    let year = date.get(0..4)?.parse::<i32>().ok()?;
    let month = date.get(5..7)?.parse::<usize>().ok()?;
    let day = date.get(8..10)?.parse::<i32>().ok()?;
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    let offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    let adjusted_year = year - i32::from(month < 3);
    let weekday = (adjusted_year + adjusted_year / 4 - adjusted_year / 100
        + adjusted_year / 400
        + offsets[month - 1]
        + day)
        .rem_euclid(7) as usize;
    Some(["sun", "mon", "tue", "wed", "thur", "fri", "sat"][weekday])
}

fn personal_daily_title(date: &str) -> String {
    let month = date
        .get(5..7)
        .and_then(|value| value.parse::<usize>().ok())
        .and_then(|month| {
            [
                "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
            ]
            .get(month.saturating_sub(1))
        })
        .copied()
        .unwrap_or("date");
    let day = date.get(8..10).unwrap_or("00");
    let weekday = weekday_for_date(date).unwrap_or("day");
    format!("{month}{day}_{weekday}_log")
}

fn frontmatter_kind(content: &str) -> Option<bool> {
    let visible = content.strip_prefix('\u{feff}').unwrap_or(content);
    let mut lines = visible.lines();
    if lines.next() != Some("---") {
        return None;
    }
    let mut frontmatter = String::new();
    for line in lines {
        if line == "---" {
            return Some(frontmatter.contains("[log](../../../tags_as_notes/type/log.md)"));
        }
        frontmatter.push_str(line);
        frontmatter.push('\n');
    }
    Some(false)
}

fn personal_frontmatter(title: &str, date: &str, newline: &str) -> String {
    [
        "---",
        "title:",
        &format!("  - {title}"),
        "type:",
        "  - \"[log](../../../tags_as_notes/type/log.md)\"",
        &format!("creation_date: {date}"),
        "update_date:",
        "---",
        "",
        "",
    ]
    .join(newline)
}

#[tauri::command]
pub fn convert_week_to_personal(
    root_path: String,
    week_name: String,
) -> Result<PersonalConversionSummary, String> {
    let week_dir = resolve_week_dir(&root_path, &week_name)?;
    let mut recognized = Vec::new();
    let index_name = format!("{week_name}_index.md");
    for entry in fs::read_dir(&week_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_file()
        {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name == index_name || daily_date(&name).is_some() {
            recognized.push((name, entry.path()));
        }
    }
    recognized.sort_by(|left, right| left.0.cmp(&right.0));
    let first_date = recognized
        .iter()
        .find_map(|(name, _)| daily_date(name))
        .unwrap_or_default();
    let mut summary = PersonalConversionSummary {
        converted: 0,
        already_personal: 0,
        skipped_custom_frontmatter: 0,
    };

    for (name, path) in recognized {
        let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        match frontmatter_kind(&content) {
            Some(true) => {
                summary.already_personal += 1;
                continue;
            }
            Some(false) => {
                summary.skipped_custom_frontmatter += 1;
                continue;
            }
            None => {}
        }
        let date = daily_date(&name).unwrap_or_else(|| first_date.clone());
        let title = if name == index_name {
            format!("{week_name}_index")
        } else {
            personal_daily_title(&date)
        };
        let newline = if content.contains("\r\n") {
            "\r\n"
        } else {
            "\n"
        };
        let (bom, body) = content
            .strip_prefix('\u{feff}')
            .map_or(("", content.as_str()), |body| ("\u{feff}", body));
        let converted = format!(
            "{bom}{}{body}",
            personal_frontmatter(&title, &date, newline)
        );
        fs::write(path, converted).map_err(|error| error.to_string())?;
        summary.converted += 1;
    }
    Ok(summary)
}

fn trash_week_with<F>(root_path: &str, week_name: &str, move_to_trash: F) -> Result<(), String>
where
    F: FnOnce(&Path) -> Result<(), String>,
{
    let week_dir = resolve_week_dir(root_path, week_name)?;
    move_to_trash(&week_dir)
}

#[tauri::command]
pub fn recycle_week(root_path: String, week_name: String) -> Result<(), String> {
    trash_week_with(&root_path, &week_name, |path| {
        trash::delete(path).map_err(|error| error.to_string())
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
    frontmatter_mode: String,
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
    let (daily_path, weekly_path) = template_paths(&frontmatter_mode)?;
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
    for (day_index, date) in dates.into_iter().enumerate() {
        let compact = date.replace('-', "");
        let path = week_dir.join(format!("{compact}_log.md"));
        let daily = fill_template(
            &daily_template,
            &[
                ("title", format!("{compact}_log")),
                ("daily_title", daily_title(&date, day_index)),
                ("date", date),
            ],
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
    fn template_initialization_creates_mode_templates_without_overwriting() {
        let root = temp_directory("templates");
        let templates = root.join("templates");
        fs::create_dir_all(&templates).unwrap();
        let customized = templates.join("daily-log.personal.md");
        fs::write(&customized, "custom").unwrap();

        ensure_templates_in_dir(&templates).unwrap();

        assert_eq!(fs::read_to_string(customized).unwrap(), "custom");
        assert!(templates.join("daily-log.no-frontmatter.md").exists());
        assert!(templates.join("weekly-index.no-frontmatter.md").exists());
        assert!(templates.join("weekly-index.personal.md").exists());
        fs::remove_dir_all(root).unwrap();
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
    fn creates_todo_only_when_requested() {
        let root = temp_directory("todo-create");
        let created = create_workspace_todo(display_path(&root)).unwrap();
        assert_eq!(created.todo_count, 4);
        assert!(root.join("todo.md").exists());
        assert!(create_workspace_todo(display_path(&root)).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn imports_markdown_to_workspace_todo_with_replace_guard() {
        let root = temp_directory("todo-import");
        let source = root.join("old-name.md");
        fs::write(&source, "# Header\n\n- [ ] Imported\nplain text").unwrap();
        let imported =
            import_workspace_todo(display_path(&root), display_path(&source), false).unwrap();
        assert_eq!(imported.todo_count, 1);
        assert_eq!(imported.raw_line_count, 2);
        assert_eq!(
            fs::read_to_string(root.join("todo.md")).unwrap(),
            "# Header\n\n- [ ] Imported\nplain text"
        );

        let other = root.join("other.md");
        fs::write(&other, "- [ ] Other").unwrap();
        assert!(import_workspace_todo(display_path(&root), display_path(&other), false).is_err());
        let replaced =
            import_workspace_todo(display_path(&root), display_path(&other), true).unwrap();
        assert!(replaced.replaced);
        assert_eq!(
            fs::read_to_string(root.join("todo.md")).unwrap(),
            "- [ ] Other"
        );
        fs::remove_dir_all(root).unwrap();
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
            super::super::config::FRONTMATTER_OFF.into(),
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
            super::super::config::FRONTMATTER_OFF.into(),
        )
        .unwrap();

        assert_eq!(repaired, vec![display_path(&missing)]);
        assert_eq!(fs::read_to_string(index).unwrap(), "keep me");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn frontmatter_mode_selects_week_templates() {
        let root = temp_directory("frontmatter-mode");
        let off_created = create_log_week(
            display_path(&root),
            2026,
            26,
            "2026-06-22".into(),
            "June 22-28".into(),
            week_dates(),
            false,
            super::super::config::FRONTMATTER_OFF.into(),
        )
        .unwrap();
        assert_eq!(off_created.len(), 8);
        let off_index = root.join("2026w26").join("2026w26_index.md");
        assert!(!fs::read_to_string(off_index).unwrap().starts_with("---"));

        let personal_root = temp_directory("frontmatter-personal");
        let personal_created = create_log_week(
            display_path(&personal_root),
            2026,
            27,
            "2026-06-29".into(),
            "June 29-July 5".into(),
            (29..=30)
                .map(|day| format!("2026-06-{day:02}"))
                .chain((1..=5).map(|day| format!("2026-07-{day:02}")))
                .collect(),
            false,
            super::super::config::FRONTMATTER_PERSONAL.into(),
        )
        .unwrap();
        assert_eq!(personal_created.len(), 8);
        let personal_index = personal_root.join("2026w27").join("2026w27_index.md");
        let personal_day = personal_root.join("2026w27").join("20260629_log.md");
        let personal_index_content = fs::read_to_string(personal_index).unwrap();
        let personal_day_content = fs::read_to_string(personal_day).unwrap();
        assert!(personal_index_content.contains("title:\n  - 2026w27_index"));
        assert!(personal_index_content
            .contains("type:\n  - \"[log](../../../tags_as_notes/type/log.md)\""));
        assert!(personal_day_content.contains("title:\n  - jun29_mon_log"));
        assert!(personal_day_content
            .contains("type:\n  - \"[log](../../../tags_as_notes/type/log.md)\""));
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(personal_root).unwrap();
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
            super::super::config::FRONTMATTER_OFF.into(),
        );
        assert!(result.is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn log_tree_ignores_unrelated_workspace_files() {
        let root = temp_directory("tree-ignore");
        fs::write(root.join("todo.md"), "- [ ] todo").unwrap();
        fs::write(root.join("notes.md"), "ignore").unwrap();
        fs::create_dir_all(root.join("random")).unwrap();
        let week = root.join("2026w26");
        fs::create_dir_all(&week).unwrap();
        fs::write(week.join("2026w26_index.md"), "index").unwrap();
        fs::write(week.join("20260622_log.md"), "day").unwrap();
        fs::write(week.join("misc.md"), "ignore").unwrap();

        let tree = list_log_tree(display_path(&root)).unwrap();

        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].name, "2026w26");
        assert_eq!(tree[0].days.len(), 1);
        assert_eq!(tree[0].days[0].name, "20260622_log.md");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn week_mutations_reject_invalid_outside_and_symlink_targets() {
        let root = temp_directory("week-target-validation");
        let outside = temp_directory("week-target-outside");
        fs::create_dir_all(root.join("2026w26")).unwrap();

        assert!(resolve_week_dir(&display_path(&root), "2026w26").is_ok());
        assert!(resolve_week_dir(&display_path(&root), "../2026w26").is_err());
        assert!(resolve_week_dir(&display_path(&root), "2026w00").is_err());
        assert!(resolve_week_dir(&display_path(&root), "2026w54").is_err());
        assert!(resolve_week_dir(&display_path(&root), "random").is_err());

        #[cfg(windows)]
        {
            use std::os::windows::fs::symlink_dir;
            let linked = root.join("2026w27");
            if symlink_dir(&outside, &linked).is_ok() {
                assert!(resolve_week_dir(&display_path(&root), "2026w27").is_err());
                fs::remove_dir(linked).unwrap();
            }
        }

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn converts_recognized_week_markdown_without_changing_body_content() {
        let root = temp_directory("week-personal-convert");
        let week = root.join("2026w26");
        fs::create_dir_all(&week).unwrap();
        let index_body = "# 2026 - Week 26 - June 22 - 28\r\n\r\n## Notes\r\n\r\nkeep index\r\n";
        let day_body = "# 2026-06-22\n\n## Notes\n\nkeep day\n";
        fs::write(week.join("2026w26_index.md"), index_body).unwrap();
        fs::write(week.join("20260622_log.md"), day_body).unwrap();
        fs::write(week.join("misc.md"), "leave me").unwrap();

        let summary = convert_week_to_personal(display_path(&root), "2026w26".into()).unwrap();

        assert_eq!(summary.converted, 2);
        assert_eq!(summary.already_personal, 0);
        assert_eq!(summary.skipped_custom_frontmatter, 0);
        let converted_index = fs::read_to_string(week.join("2026w26_index.md")).unwrap();
        assert!(converted_index.starts_with("---\r\ntitle:\r\n  - 2026w26_index\r\n"));
        assert!(converted_index.contains("---\r\n\r\n# 2026 - Week 26"));
        assert!(converted_index.ends_with(index_body));
        let converted_day = fs::read_to_string(week.join("20260622_log.md")).unwrap();
        assert!(converted_day.contains("  - jun22_mon_log\n"));
        assert!(converted_day.ends_with(day_body));
        assert_eq!(
            fs::read_to_string(week.join("misc.md")).unwrap(),
            "leave me"
        );

        let second = convert_week_to_personal(display_path(&root), "2026w26".into()).unwrap();
        assert_eq!(second.converted, 0);
        assert_eq!(second.already_personal, 2);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn personal_conversion_skips_unfamiliar_frontmatter() {
        let root = temp_directory("week-personal-custom-frontmatter");
        let week = root.join("2026w26");
        fs::create_dir_all(&week).unwrap();
        let custom = "---\ncustom: keep\n---\n\n# 2026-06-22\n";
        fs::write(week.join("20260622_log.md"), custom).unwrap();

        let summary = convert_week_to_personal(display_path(&root), "2026w26".into()).unwrap();

        assert_eq!(summary.converted, 0);
        assert_eq!(summary.skipped_custom_frontmatter, 1);
        assert_eq!(
            fs::read_to_string(week.join("20260622_log.md")).unwrap(),
            custom
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn recycle_operation_receives_only_a_validated_week_directory() {
        let root = temp_directory("week-recycle-validation");
        let week = root.join("2026w26");
        fs::create_dir_all(&week).unwrap();
        let expected = fs::canonicalize(&week).unwrap();
        let mut received = None;

        trash_week_with(&display_path(&root), "2026w26", |path| {
            received = Some(path.to_path_buf());
            fs::remove_dir_all(path).map_err(|error| error.to_string())
        })
        .unwrap();

        assert_eq!(received, Some(expected));
        assert!(!week.exists());
        assert!(trash_week_with(&display_path(&root), "../2026w26", |_| Ok(())).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
