// @ts-nocheck
import { invoke } from "@tauri-apps/api/core";

export async function readSessionHistory(rootPath, usedAt = new Date().toISOString()) {
  return await invoke("read_session_history", { rootPath, usedAt });
}

export async function rebuildSessionHistory(rootPath, usedAt = new Date().toISOString()) {
  return await invoke("rebuild_session_history", { rootPath, usedAt });
}

export async function recordSessions(sessions, usedAt = new Date().toISOString()) {
  return await invoke("record_sessions", { sessions, usedAt });
}
