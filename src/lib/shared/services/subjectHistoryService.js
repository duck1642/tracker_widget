// @ts-nocheck
import { invoke } from "@tauri-apps/api/core";

export async function readSubjectHistory(rootPath, usedAt = new Date().toISOString()) {
  return await invoke("read_subject_history", { rootPath, usedAt });
}

export async function rebuildSubjectHistory(rootPath, usedAt = new Date().toISOString()) {
  return await invoke("rebuild_subject_history", { rootPath, usedAt });
}

export async function recordSubjects(subjects, usedAt = new Date().toISOString()) {
  return await invoke("record_subjects", { subjects, usedAt });
}
