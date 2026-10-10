import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { FrontmatterMode, LogWeekEntry, PersonalConversionSummary, TodoImportSummary } from "./types.ts";
import type { WeekDescriptor } from "$lib/features/weekly/types.ts";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function getISOWeek(date: Date) {
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const year = current.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  return { year, week: Math.ceil((((current.getTime() - start.getTime()) / 86400000) + 1) / 7) };
}

export function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatCompactDate(date: Date) {
  return formatDate(date).replaceAll("-", "");
}

function mondayFor(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() || 7) - 1));
  return result;
}

function rangeLabel(start: Date, end: Date) {
  if (start.getFullYear() !== end.getFullYear()) {
    return `${MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} - ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${MONTHS[start.getMonth()]} ${start.getDate()} - ${MONTHS[end.getMonth()]} ${end.getDate()}`;
  }
  return `${MONTHS[start.getMonth()]} ${start.getDate()} - ${end.getDate()}`;
}

export function getWeekDescriptor(date: Date): WeekDescriptor {
  const start = mondayFor(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const iso = getISOWeek(start);
  return {
    ...iso,
    start,
    end,
    folderName: `${iso.year}w${String(iso.week).padStart(2, "0")}`,
    rangeLabel: rangeLabel(start, end),
    dates: Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(day.getDate() + index);
      return day;
    })
  };
}

export function dateForISOWeek(year: number, week: number) {
  const isoYear = Number(year);
  const isoWeek = Number(week);
  if (!Number.isInteger(isoYear) || !Number.isInteger(isoWeek) || isoWeek < 1 || isoWeek > 53) {
    throw new Error("Invalid ISO week");
  }

  const januaryFourth = new Date(isoYear, 0, 4);
  const firstMonday = mondayFor(januaryFourth);
  const result = new Date(firstMonday);
  result.setDate(result.getDate() + (isoWeek - 1) * 7);
  const resolved = getISOWeek(result);
  if (resolved.year !== isoYear || resolved.week !== isoWeek) {
    throw new Error("Invalid ISO week");
  }
  return result;
}

export function getConsecutiveWeekDescriptors(startDate: Date, count: number) {
  const weekCount = Number(count);
  if (!Number.isInteger(weekCount) || weekCount < 1 || weekCount > 12) {
    throw new Error("Week count must be between 1 and 12");
  }

  const firstMonday = mondayFor(startDate);
  return Array.from({ length: weekCount }, (_, index) => {
    const date = new Date(firstMonday);
    date.setDate(date.getDate() + index * 7);
    return getWeekDescriptor(date);
  });
}

export function dayLabel(date: Date) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
}

export async function listLogTree(rootPath: string) {
  return await invoke<LogWeekEntry[]>("list_log_tree", { rootPath });
}

export async function pathExists(path: string) {
  return await invoke<boolean>("path_exists", { path });
}

export async function createWeek(rootPath: string, date: Date, frontmatterMode: FrontmatterMode = "off") {
  const descriptor = getWeekDescriptor(date);
  return await invoke<string[]>("create_log_week", {
    rootPath,
    year: descriptor.year,
    week: descriptor.week,
    startDate: formatDate(descriptor.start),
    rangeLabel: descriptor.rangeLabel,
    dates: descriptor.dates.map(formatDate),
    missingOnly: true,
    frontmatterMode
  });
}

export async function convertWeekToPersonal(rootPath: string, weekName: string) {
  return await invoke<PersonalConversionSummary>("convert_week_to_personal", { rootPath, weekName });
}

export async function recycleWeek(rootPath: string, weekName: string) {
  await invoke<void>("recycle_week", { rootPath, weekName });
}

export function todoPathForWorkspace(rootPath: string) {
  if (!rootPath) return "";
  const separator = rootPath.includes("\\") ? "\\" : "/";
  return `${rootPath.replace(/[\\/]$/, "")}${separator}todo.md`;
}

export function scratchpadPathForWorkspace(rootPath: string) {
  if (!rootPath) return "";
  const separator = rootPath.includes("\\") ? "\\" : "/";
  return `${rootPath.replace(/[\\/]$/, "")}${separator}scratchpad.md`;
}

export function pathBelongsToWeek(path: string, weekPath: string) {
  const normalizedPath = String(path || "").replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
  const normalizedWeek = String(weekPath || "").replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
  return Boolean(normalizedPath && normalizedWeek)
    && (normalizedPath === normalizedWeek || normalizedPath.startsWith(`${normalizedWeek}/`));
}

export function countTodoItems(markdown: string) {
  return markdown.split(/\r?\n/).filter((line) => {
    const trimmed = line.trimStart();
    return trimmed.startsWith("- [ ] ") || trimmed.startsWith("- [x] ") || trimmed.startsWith("- [X] ");
  }).length;
}

export async function selectLogsFolder() {
  const selected: unknown = await open({ directory: true, multiple: false, title: "Select logs folder" });
  if (typeof selected === "string") return selected;
  if (Array.isArray(selected) && selected.length > 0 && typeof selected[0] === "string") return selected[0];
  if (selected && typeof selected === "object" && "path" in selected && typeof selected.path === "string") return selected.path;
  return null;
}

export async function selectTodoFile() {
  const selected: unknown = await open({
    directory: false,
    multiple: false,
    title: "Select Todo Markdown file",
    filters: [
      {
        name: "Markdown",
        extensions: ["md"]
      }
    ]
  });
  if (typeof selected === "string") return selected;
  if (Array.isArray(selected) && selected.length > 0 && typeof selected[0] === "string") return selected[0];
  return null;
}

export async function createWorkspaceTodo(rootPath: string) {
  return await invoke<TodoImportSummary>("create_workspace_todo", { rootPath });
}

export async function importWorkspaceTodo(rootPath: string, sourcePath: string, replace = false) {
  return await invoke<TodoImportSummary>("import_workspace_todo", { rootPath, sourcePath, replace });
}
