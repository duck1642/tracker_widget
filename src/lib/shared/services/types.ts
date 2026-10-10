export type LayerMode = "normal" | "top" | "desktop";
export type FrontmatterMode = "off" | "personal";
export interface AppConfig {
  file_path: string; logs_root_path: string; layer_mode: string;
  drag_enabled: boolean; autostart_enabled: boolean;
  frontmatter_mode: string; developer_mode: boolean;
}
export interface LogDayEntry {
    name: string;
    path: string;
    date: string;
}
export interface LogWeekEntry {
    name: string;
    path: string;
    indexPath: string | null;
    days: LogDayEntry[];
}
export interface TodoImportSummary {
    path: string;
    todoCount: number;
    rawLineCount: number;
    replaced: boolean;
}
export interface PersonalConversionSummary {
    converted: number;
    alreadyPersonal: number;
    skippedCustomFrontmatter: number;
}
export interface SubjectHistoryEntry { count: number; last_used: string }
export interface SubjectHistory { subjects: Record<string, SubjectHistoryEntry> }
export interface SessionHistoryEntry {
    planned_count: number;
    actual_count: number;
    last_used: string;
}
export interface SessionHistory { sessions: Record<string, SessionHistoryEntry> }
export interface StatusSink { showStatus(message: string): void }
export interface SessionSuggestion { name: string; plannedThisWeek: boolean }
