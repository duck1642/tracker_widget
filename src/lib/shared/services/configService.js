import { invoke } from "@tauri-apps/api/core";

export async function readConfig() {
  return await invoke("read_config");
}

/** @param {any} config */
export async function writeConfig(config) {
  return await invoke("write_config", { config });
}
