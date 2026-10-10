import { invoke } from "@tauri-apps/api/core";
import type { AppConfig } from "./types.ts";

export async function readConfig() {
  return await invoke<AppConfig>("read_config");
}


export async function writeConfig(config: AppConfig) {
  await invoke<void>("write_config", { config });
}
