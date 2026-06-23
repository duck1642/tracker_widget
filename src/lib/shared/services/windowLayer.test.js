// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn(async () => {});
const appWindow = {
  setAlwaysOnBottom: vi.fn(async () => {}),
  setSkipTaskbar: vi.fn(async () => {}),
  isMinimized: vi.fn(async () => false),
  unminimize: vi.fn(async () => {}),
  show: vi.fn(async () => {})
};

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => appWindow
}));

const { applyLayerMode } = await import("./windowLayer.js");

describe("applyLayerMode", () => {
  beforeEach(() => {
    invoke.mockClear();
    appWindow.setAlwaysOnBottom.mockClear();
    appWindow.setSkipTaskbar.mockClear();
    appWindow.isMinimized.mockReset();
    appWindow.isMinimized.mockResolvedValue(false);
    appWindow.unminimize.mockClear();
    appWindow.show.mockClear();
    vi.useRealTimers();
  });

  it("does nothing when mode is unchanged", async () => {
    await expect(applyLayerMode("desktop", "desktop")).resolves.toBe("desktop");

    expect(appWindow.setAlwaysOnBottom).not.toHaveBeenCalled();
    expect(appWindow.setSkipTaskbar).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("uses Delta-style desktop behavior", async () => {
    await expect(applyLayerMode("normal", "desktop")).resolves.toBe("desktop");

    expect(appWindow.setAlwaysOnBottom).toHaveBeenNthCalledWith(1, false);
    expect(appWindow.setSkipTaskbar).toHaveBeenNthCalledWith(1, false);
    expect(invoke).toHaveBeenCalledWith("set_always_on_top", { onTop: false });
    expect(appWindow.setSkipTaskbar).toHaveBeenNthCalledWith(2, true);
    expect(appWindow.setAlwaysOnBottom).toHaveBeenNthCalledWith(2, true);
    expect(invoke).not.toHaveBeenCalledWith("set_desktop_parent", expect.anything());
  });

  it("resets desktop behavior when returning to normal", async () => {
    await expect(applyLayerMode("desktop", "normal")).resolves.toBe("normal");

    expect(appWindow.setAlwaysOnBottom).toHaveBeenCalledWith(false);
    expect(appWindow.setSkipTaskbar).toHaveBeenCalledWith(false);
    expect(invoke).toHaveBeenCalledWith("set_always_on_top", { onTop: false });
    expect(invoke).not.toHaveBeenCalledWith("set_desktop_parent", expect.anything());
  });

  it("switches from desktop to top by resetting bottom and enabling top", async () => {
    await expect(applyLayerMode("desktop", "top")).resolves.toBe("top");

    expect(appWindow.setAlwaysOnBottom).toHaveBeenCalledWith(false);
    expect(appWindow.setSkipTaskbar).toHaveBeenCalledWith(false);
    expect(invoke).toHaveBeenNthCalledWith(1, "set_always_on_top", { onTop: false });
    expect(invoke).toHaveBeenNthCalledWith(2, "set_always_on_top", { onTop: true });
  });

  it("switches from top to desktop by resetting top and enabling bottom", async () => {
    await expect(applyLayerMode("top", "desktop")).resolves.toBe("desktop");

    expect(invoke).toHaveBeenCalledWith("set_always_on_top", { onTop: false });
    expect(appWindow.setSkipTaskbar).toHaveBeenLastCalledWith(true);
    expect(appWindow.setAlwaysOnBottom).toHaveBeenLastCalledWith(true);
  });

  it("restores desktop mode when Show Desktop minimizes the window", async () => {
    vi.useFakeTimers();
    appWindow.isMinimized.mockResolvedValue(true);

    await applyLayerMode("normal", "desktop");
    await vi.advanceTimersByTimeAsync(500);

    expect(appWindow.unminimize).toHaveBeenCalled();
    expect(appWindow.show).toHaveBeenCalled();
    expect(appWindow.setAlwaysOnBottom).toHaveBeenLastCalledWith(true);
  });

  it("stops the desktop guard when leaving desktop mode", async () => {
    vi.useFakeTimers();
    appWindow.isMinimized.mockResolvedValue(true);

    await applyLayerMode("normal", "desktop");
    await applyLayerMode("desktop", "normal");
    await vi.advanceTimersByTimeAsync(500);

    expect(appWindow.unminimize).not.toHaveBeenCalled();
    expect(appWindow.show).not.toHaveBeenCalled();
  });
});
