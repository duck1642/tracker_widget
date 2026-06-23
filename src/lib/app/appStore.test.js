// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { AppStore } from "./appStore.svelte.js";

function createStore(mode) {
  const applyLayerMode = vi.fn(async (_current, target) => target);
  const store = new AppStore({
    applyLayerMode,
    configService: {
      readConfig: vi.fn(async () => ({
        file_path: "todo.md",
        logs_root_path: "",
        layer_mode: mode,
        drag_enabled: true,
        autostart_enabled: false
      })),
      writeConfig: vi.fn(async () => {})
    },
    autostartService: { isEnabled: vi.fn(async () => false) }
  });
  return { store, applyLayerMode };
}

describe("AppStore native layer restoration", () => {
  it.each(["top", "desktop", "true-desktop"])("applies persisted %s mode from normal", async (mode) => {
    const { store, applyLayerMode } = createStore(mode);

    await store.loadConfig();

    expect(applyLayerMode).toHaveBeenCalledWith("normal", mode);
    expect(store.layerMode).toBe(mode);
  });

  it("falls back to normal for an invalid persisted mode", async () => {
    const { store, applyLayerMode } = createStore("invalid");

    await store.loadConfig();

    expect(applyLayerMode).toHaveBeenCalledWith("normal", "normal");
    expect(store.layerMode).toBe("normal");
  });
});
