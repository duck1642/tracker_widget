import type { LayerMode } from "./types.ts";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";


export async function applyLayerMode(currentMode: LayerMode, targetMode: LayerMode) {
  if (currentMode === targetMode) {
    return targetMode;
  }

  const appWindow = getCurrentWindow();

  await appWindow.setAlwaysOnBottom(false);
  await appWindow.setSkipTaskbar(false);
  await invoke<void>("set_always_on_top", { onTop: false });

  if (targetMode === "top") {
    await invoke<void>("set_always_on_top", { onTop: true });
  } else if (targetMode === "desktop") {
    await appWindow.setSkipTaskbar(true);
    await appWindow.setAlwaysOnBottom(true);
  }

  return targetMode;
}
