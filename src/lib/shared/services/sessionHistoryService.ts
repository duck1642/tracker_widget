import { invoke } from "@tauri-apps/api/core";
import type { SessionHistory } from "./types.ts";

export async function readSessionHistory(rootPath: string, usedAt = new Date().toISOString()) {
  return await invoke<SessionHistory>("read_session_history", { rootPath, usedAt });
}

export async function rebuildSessionHistory(rootPath: string, usedAt = new Date().toISOString()) {
  return await invoke<SessionHistory>("rebuild_session_history", { rootPath, usedAt });
}

export async function recordSessions(sessions: string[], usedAt = new Date().toISOString()) {
  return await invoke<SessionHistory>("record_sessions", { sessions, usedAt });
}
