// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn(async () => {});
const appWindow = {
  setAlwaysOnBottom: vi.fn(async () => {}),
  setSkipTaskbar: vi.fn(async () => {})
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
  });

  it("does nothing when mode is unchanged", async () => {
    await expect(applyLayerMode("true-desktop", "true-desktop")).resolves.toBe("true-desktop");

    expect(appWindow.setAlwaysOnBottom).not.toHaveBeenCalled();
    expect(appWindow.setSkipTaskbar).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("uses fake desktop behavior for desktop mode", async () => {
    await expect(applyLayerMode("normal", "desktop")).resolves.toBe("desktop");

    expect(appWindow.setAlwaysOnBottom).toHaveBeenNthCalledWith(1, false);
    expect(appWindow.setSkipTaskbar).toHaveBeenNthCalledWith(1, false);
    expect(invoke).toHaveBeenCalledWith("set_always_on_top", { onTop: false });
    expect(appWindow.setSkipTaskbar).toHaveBeenNthCalledWith(2, true);
    expect(appWindow.setAlwaysOnBottom).toHaveBeenNthCalledWith(2, true);
    expect(invoke).not.toHaveBeenCalledWith("set_desktop_parent", expect.anything());
  });

  it("resets fake desktop behavior when returning to normal", async () => {
    await expect(applyLayerMode("desktop", "normal")).resolves.toBe("normal");

    expect(appWindow.setAlwaysOnBottom).toHaveBeenCalledWith(false);
    expect(appWindow.setSkipTaskbar).toHaveBeenCalledWith(false);
    expect(invoke).toHaveBeenCalledWith("set_always_on_top", { onTop: false });
    expect(invoke).not.toHaveBeenCalledWith("set_desktop_parent", expect.anything());
  });

  it("switches from fake desktop to top by resetting bottom and enabling top", async () => {
    await expect(applyLayerMode("desktop", "top")).resolves.toBe("top");

    expect(appWindow.setAlwaysOnBottom).toHaveBeenCalledWith(false);
    expect(appWindow.setSkipTaskbar).toHaveBeenCalledWith(false);
    expect(invoke).toHaveBeenNthCalledWith(1, "set_always_on_top", { onTop: false });
    expect(invoke).toHaveBeenNthCalledWith(2, "set_always_on_top", { onTop: true });
  });

  it("switches from top to fake desktop by resetting top and enabling bottom", async () => {
    await expect(applyLayerMode("top", "desktop")).resolves.toBe("desktop");

    expect(invoke).toHaveBeenCalledWith("set_always_on_top", { onTop: false });
    expect(appWindow.setSkipTaskbar).toHaveBeenLastCalledWith(true);
    expect(appWindow.setAlwaysOnBottom).toHaveBeenLastCalledWith(true);
  });

  it("uses the native parent path for true desktop", async () => {
    await expect(applyLayerMode("normal", "true-desktop")).resolves.toBe("true-desktop");

    expect(appWindow.setAlwaysOnBottom).toHaveBeenCalledWith(false);
    expect(appWindow.setSkipTaskbar).toHaveBeenCalledWith(false);
    expect(invoke).toHaveBeenCalledWith("set_always_on_top", { onTop: false });
    expect(invoke).toHaveBeenCalledWith("set_desktop_parent", { enable: true });
  });

  it("unparents true desktop before switching to fake desktop", async () => {
    await expect(applyLayerMode("true-desktop", "desktop")).resolves.toBe("desktop");

    expect(invoke).toHaveBeenNthCalledWith(1, "set_desktop_parent", { enable: false });
    expect(appWindow.setSkipTaskbar).toHaveBeenLastCalledWith(true);
    expect(appWindow.setAlwaysOnBottom).toHaveBeenLastCalledWith(true);
  });
});
