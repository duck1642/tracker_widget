import { invoke } from "@tauri-apps/api/core";
import type { SubjectHistory } from "./types.ts";

export async function readSubjectHistory(rootPath: string, usedAt = new Date().toISOString()) {
  return await invoke<SubjectHistory>("read_subject_history", { rootPath, usedAt });
}

export async function rebuildSubjectHistory(rootPath: string, usedAt = new Date().toISOString()) {
  return await invoke<SubjectHistory>("rebuild_subject_history", { rootPath, usedAt });
}

export async function recordSubjects(subjects: string[], usedAt = new Date().toISOString()) {
  return await invoke<SubjectHistory>("record_subjects", { subjects, usedAt });
}
