import { invoke } from "@tauri-apps/api/core";


export async function readFile(path: string) {
  return await invoke<string>("read_file", { path });
}


export async function writeFile(path: string, content: string) {
  await invoke<void>("write_file", { path, content });
}


export async function getFileModifiedTime(path: string) {
  return await invoke<number>("get_file_modified_time", { path });
}


export async function pathExists(path: string) {
  return await invoke<boolean>("path_exists", { path });
}
