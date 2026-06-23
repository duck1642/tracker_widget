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

  // Desktop mode is temporarily implemented like Delta Widgets: a normal
  // Tauri window kept off the taskbar and below other app windows. The
  // registered set_desktop_parent command is retained for rollback/comparison.
  await appWindow.setAlwaysOnBottom(false);
  await appWindow.setSkipTaskbar(false);
  await invoke("set_always_on_top", { onTop: false });

  if (targetMode === "top") {
    await invoke("set_always_on_top", { onTop: true });
  } else if (targetMode === "desktop") {
    await appWindow.setSkipTaskbar(true);
    await appWindow.setAlwaysOnBottom(true);
  }

  return targetMode;
}
