// @vitest-environment jsdom
// @ts-nocheck
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import AppHeader from "./AppHeader.svelte";
import AppSidebar from "./AppSidebar.svelte";
import ScratchpadPanel from "$lib/features/scratchpad/components/ScratchpadPanel.svelte";
import { appStore } from "./appStore.svelte.js";
import { workspaceStore } from "./workspaceStore.svelte.js";
import { scratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.js";
import { openPath } from "@tauri-apps/plugin-opener";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn()
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  openPath.mockReset();
  appStore.currentView = "todo";
  appStore.statusMessage = "";
  scratchpadStore.path = "";
  scratchpadStore.content = "";
  scratchpadStore.loaded = false;
  scratchpadStore.fileMissing = false;
});

describe("minor Scratchpad and sidebar patch", () => {
  it("offers explicit creation when the Scratchpad file is missing", async () => {
    scratchpadStore.fileMissing = true;
    const createScratchpad = vi.spyOn(workspaceStore, "createScratchpad").mockResolvedValue(true);
    render(ScratchpadPanel);

    expect(screen.getByText("No scratchpad.md found")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Create scratchpad" }));

    expect(createScratchpad).toHaveBeenCalledOnce();
  });

  it("does not open a missing Scratchpad in the system editor", async () => {
    appStore.currentView = "scratchpad";
    scratchpadStore.path = "C:\\Tracker\\scratchpad.md";
    render(AppSidebar, {
      open: true,
      currentView: "scratchpad",
      selectedPath: scratchpadStore.path,
      onSelectScratchpad: vi.fn(),
      onSelectWeek: vi.fn(),
      onSelectDay: vi.fn()
    });

    await fireEvent.click(screen.getByRole("button", { name: "Open active file in system editor" }));

    expect(openPath).not.toHaveBeenCalled();
    expect(appStore.statusMessage).toBe("No active file");
  });

  it("keeps the sidebar toggle stateful without relying on its hover background", async () => {
    const onToggleSidebar = vi.fn();
    render(AppHeader, {
      dragEnabled: true,
      layerMode: "normal",
      sidebarOpen: false,
      showModeMenu: false,
      onToggleSidebar
    });

    const toggle = screen.getByRole("button", { name: "Show sidebar" });
    expect(toggle.classList.contains("sidebar-toggle")).toBe(true);
    await fireEvent.click(toggle);
    expect(onToggleSidebar).toHaveBeenCalledOnce();
  });
});
