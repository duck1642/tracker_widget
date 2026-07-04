use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct SubjectHistoryEntry {
    pub count: u32,
    pub last_used: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct SubjectHistory {
    pub subjects: BTreeMap<String, SubjectHistoryEntry>,
}

fn history_path() -> PathBuf {
    super::config::get_config_path()
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("subject-history.json")
}

fn is_week_name(name: &str) -> bool {
    name.len() == 7
        && name.as_bytes()[..4].iter().all(u8::is_ascii_digit)
        && name.as_bytes()[4] == b'w'
        && name.as_bytes()[5..].iter().all(u8::is_ascii_digit)
}

fn is_daily_log_name(name: &str) -> bool {
    name.len() == 15
        && name.ends_with("_log.md")
        && name.as_bytes()[..8].iter().all(u8::is_ascii_digit)
}

fn is_weekly_index_name(name: &str, week_name: &str) -> bool {
    name == format!("{week_name}_index.md")
}

fn is_valid_subject(subject: &str) -> bool {
    !subject.is_empty()
        && subject
            .chars()
            .all(|ch| ch == '_' || ch == '-' || ch.is_alphanumeric())
}

fn split_table_row(line: &str) -> Vec<String> {
    let mut cells = Vec::new();
    let mut cell = String::new();
    let mut escaped = false;
    let trimmed = line.trim();
    for ch in trimmed.chars() {
        if escaped {
            cell.push(ch);
            escaped = false;
        } else if ch == '\\' {
            escaped = true;
        } else if ch == '|' {
            cells.push(cell.trim().to_string());
            cell.clear();
        } else {
            cell.push(ch);
        }
    }
    if !cell.is_empty() {
        cells.push(cell.trim().to_string());
    }
    if cells.first().is_some_and(String::is_empty) {
        cells.remove(0);
    }
    if cells.last().is_some_and(String::is_empty) {
        cells.pop();
    }
    cells
}

fn collect_subject_list(value: &str, output: &mut Vec<String>) {
    for subject in value
        .split(',')
        .map(|item| item.trim())
        .filter(|subject| is_valid_subject(subject))
    {
        output.push(subject.to_string());
    }
}

fn collect_inline_subjects(line: &str, output: &mut Vec<String>) {
    let Some(start) = line.find("subjects:") else {
        return;
    };
    let after_subjects = &line[start + "subjects:".len()..];
    let Some(open) = after_subjects.find('(') else {
        return;
    };
    let after_open = &after_subjects[open + 1..];
    let Some(close) = after_open.find(')') else {
        return;
    };
    collect_subject_list(&after_open[..close], output);
}

fn collect_subjects_from_markdown(content: &str) -> Vec<String> {
    let mut subjects = Vec::new();
    for line in content.lines() {
        collect_inline_subjects(line, &mut subjects);
        if line.trim_start().starts_with('|') {
            let cells = split_table_row(line);
            let subject_cell = if cells.len() >= 5 && cells[0].eq_ignore_ascii_case("id") {
                Some(3)
            } else if cells.len() >= 5 && cells[0].starts_with('p') {
                Some(3)
            } else if cells.len() >= 4 {
                Some(2)
            } else {
                None
            };
            if let Some(index) = subject_cell {
                if !cells[index].eq_ignore_ascii_case("subjects")
                    && !cells[index].chars().all(|ch| ch == '-')
                {
                    collect_subject_list(&cells[index], &mut subjects);
                }
            }
        }
    }
    subjects
}

fn record_subject(history: &mut SubjectHistory, subject: &str, used_at: &str) {
    let entry = history
        .subjects
        .entry(subject.to_string())
        .or_insert_with(|| SubjectHistoryEntry {
            count: 0,
            last_used: used_at.to_string(),
        });
    entry.count = entry.count.saturating_add(1);
    entry.last_used = used_at.to_string();
}

fn write_history(history: &SubjectHistory) -> Result<(), String> {
    let path = history_path();
    let json = serde_json::to_string_pretty(history).map_err(|error| error.to_string())?;
    fs::write(path, json).map_err(|error| error.to_string())
}

fn rebuild_from_workspace(root_path: &str, used_at: &str) -> Result<SubjectHistory, String> {
    let root = Path::new(root_path);
    let mut history = SubjectHistory::default();
    if !root.is_dir() {
        write_history(&history)?;
        return Ok(history);
    }
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let week_name = entry.file_name().to_string_lossy().to_string();
        let week_path = entry.path();
        if !week_path.is_dir() || !is_week_name(&week_name) {
            continue;
        }
        for child in fs::read_dir(&week_path).map_err(|error| error.to_string())? {
            let child = child.map_err(|error| error.to_string())?;
            let child_name = child.file_name().to_string_lossy().to_string();
            if !is_daily_log_name(&child_name) && !is_weekly_index_name(&child_name, &week_name) {
                continue;
            }
            let content = fs::read_to_string(child.path()).map_err(|error| error.to_string())?;
            for subject in collect_subjects_from_markdown(&content) {
                record_subject(&mut history, &subject, used_at);
            }
        }
    }
    write_history(&history)?;
    Ok(history)
}

#[tauri::command]
pub fn read_subject_history(root_path: String, used_at: String) -> Result<SubjectHistory, String> {
    let path = history_path();
    if !path.exists() {
        return rebuild_from_workspace(&root_path, &used_at);
    }
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    match serde_json::from_str::<SubjectHistory>(&content) {
        Ok(history) => Ok(history),
        Err(_) => rebuild_from_workspace(&root_path, &used_at),
    }
}

#[tauri::command]
pub fn rebuild_subject_history(root_path: String, used_at: String) -> Result<SubjectHistory, String> {
    rebuild_from_workspace(&root_path, &used_at)
}

#[tauri::command]
pub fn record_subjects(subjects: Vec<String>, used_at: String) -> Result<SubjectHistory, String> {
    let path = history_path();
    let mut history = if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str::<SubjectHistory>(&content).ok())
            .unwrap_or_default()
    } else {
        SubjectHistory::default()
    };
    for subject in subjects.iter().filter(|subject| is_valid_subject(subject)) {
        record_subject(&mut history, subject, &used_at);
    }
    write_history(&history)?;
    Ok(history)
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
        let path = std::env::temp_dir().join(format!("tracker-widget-subject-{label}-{stamp}"));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn collects_inline_and_table_subjects() {
        let content = "- {subjects: (rust, sürücü_belgesi), time: 0m} Work\n| Mon | Dev | rust, test | 60 |\n| --- | --- | --- | ---: |\n| Tue | Bad | bad subject | 10 |";
        assert_eq!(
            collect_subjects_from_markdown(content),
            vec!["rust", "sürücü_belgesi", "rust", "test"]
        );
    }

    #[test]
    fn rebuild_scans_recognized_workspace_files() {
        let root = temp_directory("rebuild");
        let week = root.join("2026w27");
        fs::create_dir_all(&week).unwrap();
        fs::write(
            week.join("2026w27_index.md"),
            "## Objectives\n\n- {subjects: (weekly), origin: planned, status: open} Ship\n\n## Weekly Plan\n\n| Day | Session | Subjects | Target Minutes |\n| --- | --- | --- | ---: |\n| Mon | Dev | rust, test | 60 |\n\n## Weekly Actual\n\n<!-- tracker:actual:start -->\n| Day | Session | Subjects | Actual Minutes |\n| --- | --- | --- | ---: |\n| Mon | Dev | rust | 30 |\n<!-- tracker:actual:end -->",
        )
        .unwrap();
        fs::write(
            week.join("20260703_log.md"),
            "## Work\n\n- {subjects: (daily), time: 0m} Task",
        )
        .unwrap();
        fs::write(week.join("random.md"), "- {subjects: (ignored), time: 1m} No").unwrap();

        let history = rebuild_from_workspace(root.to_str().unwrap(), "now").unwrap();

        assert_eq!(history.subjects["rust"].count, 2);
        assert!(history.subjects.contains_key("weekly"));
        assert!(history.subjects.contains_key("test"));
        assert!(history.subjects.contains_key("daily"));
        assert!(!history.subjects.contains_key("ignored"));
        fs::remove_dir_all(root).unwrap();
    }
}
