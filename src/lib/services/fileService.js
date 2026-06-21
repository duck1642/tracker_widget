import { invoke } from "@tauri-apps/api/core";

export async function getDefaultPath() {
  return await invoke("get_default_path");
}

/** @param {string} path */
export async function readFile(path) {
  return await invoke("read_file", { path });
}

/**
 * @param {string} path
 * @param {string} content
 */
export async function writeFile(path, content) {
  return await invoke("write_file", { path, content });
}

/** @param {string} path */
export async function getFileModifiedTime(path) {
  return await invoke("get_file_modified_time", { path });
}

/**
 * @param {string} path
 * @param {string} entryJson
 */
export async function logHistory(path, entryJson) {
  return await invoke("log_history_entry", { path, entryJson });
}

/** @param {string} path */
export async function popHistory(path) {
  return await invoke("pop_history_entry", { path });
}
