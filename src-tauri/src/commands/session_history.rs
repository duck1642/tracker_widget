use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct SessionHistoryEntry {
    pub planned_count: u32,
    pub actual_count: u32,
    pub last_used: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct SessionHistory {
    pub sessions: BTreeMap<String, SessionHistoryEntry>,
}

fn history_path() -> PathBuf {
    super::config::get_config_path()
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("session-history.json")
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

fn is_valid_session_name(name: &str) -> bool {
    let normalized = name.trim();
    !normalized.is_empty()
        && !["notes", "total time"].contains(&normalized.to_lowercase().as_str())
        && !normalized.contains('\n')
        && !normalized.contains('\r')
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

fn collect_weekly_plan_sessions(content: &str) -> Vec<String> {
    let mut sessions = Vec::new();
    let mut in_weekly_plan = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(heading) = trimmed.strip_prefix("## ") {
            in_weekly_plan = heading.trim().eq_ignore_ascii_case("weekly plan");
            continue;
        }
        if !in_weekly_plan || !trimmed.starts_with('|') {
            continue;
        }
        let cells = split_table_row(trimmed);
        let session_index = if cells.len() >= 5 && cells[0].eq_ignore_ascii_case("id") {
            Some(2)
        } else if cells.len() >= 5 && cells[0].starts_with('p') {
            Some(2)
        } else if cells.len() >= 4 {
            Some(1)
        } else {
            None
        };
        if let Some(index) = session_index {
            let session = cells[index].trim();
            if !session.eq_ignore_ascii_case("session")
                && !session.chars().all(|ch| ch == '-')
                && is_valid_session_name(session)
            {
                sessions.push(session.to_string());
            }
        }
    }
    sessions
}

fn collect_daily_sessions(content: &str) -> Vec<String> {
    content
        .lines()
        .filter_map(|line| line.trim().strip_prefix("## "))
        .map(str::trim)
        .filter(|name| is_valid_session_name(name))
        .map(str::to_string)
        .collect()
}

fn record_planned_session(history: &mut SessionHistory, session: &str, used_at: &str) {
    let entry = history
        .sessions
        .entry(session.to_string())
        .or_insert_with(|| SessionHistoryEntry {
            planned_count: 0,
            actual_count: 0,
            last_used: used_at.to_string(),
        });
    entry.planned_count = entry.planned_count.saturating_add(1);
    entry.last_used = used_at.to_string();
}

fn record_actual_session(history: &mut SessionHistory, session: &str, used_at: &str) {
    let entry = history
        .sessions
        .entry(session.to_string())
        .or_insert_with(|| SessionHistoryEntry {
            planned_count: 0,
            actual_count: 0,
            last_used: used_at.to_string(),
        });
    entry.actual_count = entry.actual_count.saturating_add(1);
    entry.last_used = used_at.to_string();
}

fn write_history(history: &SessionHistory) -> Result<(), String> {
    let path = history_path();
    let json = serde_json::to_string_pretty(history).map_err(|error| error.to_string())?;
    fs::write(path, json).map_err(|error| error.to_string())
}

fn rebuild_from_workspace(root_path: &str, used_at: &str) -> Result<SessionHistory, String> {
    let root = Path::new(root_path);
    let mut history = SessionHistory::default();
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
            if is_weekly_index_name(&child_name, &week_name) {
                for session in collect_weekly_plan_sessions(&content) {
                    record_planned_session(&mut history, &session, used_at);
                }
            } else {
                for session in collect_daily_sessions(&content) {
                    record_actual_session(&mut history, &session, used_at);
                }
            }
        }
    }
    write_history(&history)?;
    Ok(history)
}

#[tauri::command]
pub fn read_session_history(root_path: String, used_at: String) -> Result<SessionHistory, String> {
    let path = history_path();
    if !path.exists() {
        return rebuild_from_workspace(&root_path, &used_at);
    }
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    match serde_json::from_str::<SessionHistory>(&content) {
        Ok(history) => Ok(history),
        Err(_) => rebuild_from_workspace(&root_path, &used_at),
    }
}

#[tauri::command]
pub fn rebuild_session_history(
    root_path: String,
    used_at: String,
) -> Result<SessionHistory, String> {
    rebuild_from_workspace(&root_path, &used_at)
}

#[tauri::command]
pub fn record_sessions(sessions: Vec<String>, used_at: String) -> Result<SessionHistory, String> {
    let path = history_path();
    let mut history = if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str::<SessionHistory>(&content).ok())
            .unwrap_or_default()
    } else {
        SessionHistory::default()
    };
    for session in sessions
        .iter()
        .map(|session| session.trim())
        .filter(|session| is_valid_session_name(session))
    {
        record_actual_session(&mut history, session, &used_at);
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
        let path = std::env::temp_dir().join(format!("tracker-widget-session-{label}-{stamp}"));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn collects_weekly_plan_sessions_only_from_plan_section() {
        let content = "## Weekly Plan\n\n| ID | Day | Session | Subjects | Target Minutes |\n| --- | --- | --- | --- | ---: |\n| p1 | Mon | Calc1 study | math | 60 |\n\n## Weekly Actual\n\n| Day | Session | Subjects | Actual Minutes |\n| Mon | Derived actual | math | 60 |";
        assert_eq!(collect_weekly_plan_sessions(content), vec!["Calc1 study"]);
    }

    #[test]
    fn collects_daily_session_headings_without_reserved_sections() {
        let content = "# 2026-07-05\n\n## Work\n\n## Total Time\n\n0m\n\n## Notes\n\n- note";
        assert_eq!(collect_daily_sessions(content), vec!["Work"]);
    }

    #[test]
    fn rebuild_scans_planned_and_actual_sessions() {
        let root = temp_directory("rebuild");
        let week = root.join("2026w27");
        fs::create_dir_all(&week).unwrap();
        fs::write(
            week.join("2026w27_index.md"),
            "## Weekly Plan\n\n| ID | Day | Session | Subjects | Target Minutes |\n| --- | --- | --- | --- | ---: |\n| p1 | Mon | Planned Work | rust | 60 |\n\n## Weekly Actual\n\n| Day | Session | Subjects | Actual Minutes |\n| --- | --- | --- | ---: |\n| Mon | Ignored Actual | rust | 60 |",
        )
        .unwrap();
        fs::write(
            week.join("20260705_log.md"),
            "# 2026-07-05\n\n## Actual Work\n\n- {subjects: (daily), time: 0m} Task\n\n## Total Time\n\n0m\n\n## Notes\n",
        )
        .unwrap();
        fs::write(week.join("random.md"), "## Ignored").unwrap();

        let history = rebuild_from_workspace(root.to_str().unwrap(), "now").unwrap();

        assert_eq!(history.sessions["Planned Work"].planned_count, 1);
        assert_eq!(history.sessions["Planned Work"].actual_count, 0);
        assert_eq!(history.sessions["Actual Work"].actual_count, 1);
        assert!(!history.sessions.contains_key("Ignored Actual"));
        fs::remove_dir_all(root).unwrap();
    }
}
