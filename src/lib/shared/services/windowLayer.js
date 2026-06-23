import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * @param {string} currentMode
 * @param {string} targetMode
 */
export async function applyLayerMode(currentMode, targetMode) {
  if (currentMode === targetMode) {
    return targetMode;
  }

  const appWindow = getCurrentWindow();

  if (currentMode === "true-desktop" && targetMode !== "true-desktop") {
    await invoke("set_desktop_parent", { enable: false });
  }

  await appWindow.setAlwaysOnBottom(false);
  await appWindow.setSkipTaskbar(false);
  await invoke("set_always_on_top", { onTop: false });

  if (targetMode === "top") {
    await invoke("set_always_on_top", { onTop: true });
  } else if (targetMode === "desktop") {
    await appWindow.setSkipTaskbar(true);
    await appWindow.setAlwaysOnBottom(true);
  } else if (targetMode === "true-desktop") {
    await invoke("set_desktop_parent", { enable: true });
  }

  return targetMode;
}
