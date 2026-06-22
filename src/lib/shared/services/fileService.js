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

/** @param {string} path */
export async function pathExists(path) {
  return await invoke("path_exists", { path });
}

/** @param {string} rootPath @param {{path: string, content: string}[]} changes */
export async function applyLogMigration(rootPath, changes) {
  return await invoke("apply_log_migration", { rootPath, changes });
}
