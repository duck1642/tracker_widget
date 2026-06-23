import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** @type {ReturnType<typeof setInterval> | null} */
let desktopGuardId = null;

function stopDesktopGuard() {
  if (desktopGuardId !== null) {
    clearInterval(desktopGuardId);
    desktopGuardId = null;
  }
}

/** @param {ReturnType<typeof getCurrentWindow>} appWindow */
function startDesktopGuard(appWindow) {
  stopDesktopGuard();
  desktopGuardId = setInterval(async () => {
    try {
      if (!(await appWindow.isMinimized())) return;

      await appWindow.unminimize();
      await appWindow.show();
      await appWindow.setAlwaysOnBottom(true);
    } catch {
      // Best-effort recovery only. Mode changes still handle real errors.
    }
  }, 500);
}

/**
 * @param {string} currentMode
 * @param {string} targetMode
 */
export async function applyLayerMode(currentMode, targetMode) {
  if (currentMode === targetMode) {
    return targetMode;
  }

  const appWindow = getCurrentWindow();

  stopDesktopGuard();

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
    startDesktopGuard(appWindow);
  }

  return targetMode;
}
