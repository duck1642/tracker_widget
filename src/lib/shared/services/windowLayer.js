import { invoke } from "@tauri-apps/api/core";

/**
 * @param {string} currentMode
 * @param {string} targetMode
 */
export async function applyLayerMode(currentMode, targetMode) {
  if (currentMode === targetMode) {
    return targetMode;
  }

  // If leaving desktop mode, unparent first
  if (currentMode === "desktop" && targetMode !== "desktop") {
    await invoke("set_desktop_parent", { enable: false });
  }

  // Reset top flag (always on bottom is skipped/removed)
  await invoke("set_always_on_top", { onTop: false });

  if (targetMode === "top") {
    await invoke("set_always_on_top", { onTop: true });
  } else if (targetMode === "desktop") {
    await invoke("set_desktop_parent", { enable: true });
  }

  return targetMode;
}
