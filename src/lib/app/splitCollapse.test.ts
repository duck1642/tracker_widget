import { requireValue } from "$lib/shared/testing/testHelpers.ts";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import AppShell from "./AppShell.svelte";
import { appStore } from "./appStore.svelte.ts";
import { workspaceStore } from "./workspaceStore.svelte.ts";
import { subjectHistoryStore } from "./subjectHistoryStore.svelte.ts";
import { sessionHistoryStore } from "./sessionHistoryStore.svelte.ts";
import { installInteractionTestSetup } from "./interactionTestSetup.ts";

vi.mock("@tauri-apps/api/window", () => ({
  LogicalSize: class {},
  getCurrentWindow: () => ({
    isMaximized: async () => true,
    setMinSize: async () => {},
    onResized: async () => () => {},
    onCloseRequested: async () => () => {}
  })
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("$lib/shared/services/fileService.ts", () => ({
  pathExists: async () => true,
  readFile: async (path: string) => path.endsWith("scratchpad.md") ? "Surviving scratchpad note"
    : path.endsWith("todo.md") ? "- [ ] Surviving todo\n" : "# 2026-10-05\n",
  writeFile: async () => {}
}));

installInteractionTestSetup();

beforeEach(() => {
  appStore.logsRootPath = "workspace";
  appStore.filePath = "workspace/todo.md";
  workspaceStore.sidebarOpen = true;
  workspaceStore.weeks = [{ name: "2026w41", path: "workspace/2026w41", indexPath: "workspace/2026w41/index.md", days: [{name:"2026-10-05", path: "workspace/2026w41/day.md", date: "2026-10-05" }] }];
  vi.spyOn(appStore, "loadConfig").mockResolvedValue(null);
  vi.spyOn(workspaceStore, "refresh").mockResolvedValue(true);
  vi.spyOn(subjectHistoryStore, "load").mockResolvedValue(true);
  vi.spyOn(sessionHistoryStore, "load").mockResolvedValue(true);
});

async function openScratchpadInSplit() {
  render(AppShell);
  await vi.waitFor(() => expect(screen.getByDisplayValue<HTMLInputElement | HTMLTextAreaElement>("Surviving todo")).toBeTruthy());
  const navigation = screen.getByRole("navigation", { name: "Primary views" });
  await fireEvent.contextMenu(requireValue(within(requireValue(navigation)).getByRole<HTMLButtonElement>("button", { name: "Scratchpad" })));
  await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Open in split view" })));
  await vi.waitFor(() => expect(screen.getByText("Surviving scratchpad note")).toBeTruthy());
}

describe("collapsing split view", () => {
  it("displays the surviving Scratchpad immediately after closing the last left tab", async () => {
    await openScratchpadInSplit();
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Close Todo" })));
    await vi.waitFor(() => expect(screen.queryByRole("separator", { name: "Resize split view" })).toBeNull());

    await vi.waitFor(() => expect(screen.getByText("Surviving scratchpad note")).toBeTruthy());
    expect(screen.queryByText("No tabs open")).toBeNull();
    expect(appStore.currentView).toBe("scratchpad");
    expect(requireValue(screen.getByTitle("Open Scratchpad").parentElement).classList.contains("active")).toBe(true);
  });

  it("preserves the active right tab when several tabs survive", async () => {
    await openScratchpadInSplit();
    await fireEvent(screen.getByRole<HTMLButtonElement>("button", { name: "2026-10-05" }), new MouseEvent("auxclick", { button: 1, bubbles: true }));
    await vi.waitFor(() => expect(screen.getByTitle("Open 2026-10-05")).toBeTruthy());
    await fireEvent.click(requireValue(screen.getByTitle("Open 2026-10-05")));
    await vi.waitFor(() => expect(screen.getByRole("heading", { name: "Monday, October 5, 2026" })).toBeTruthy());
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Close Todo" })));
    await vi.waitFor(() => expect(screen.queryByRole("separator", { name: "Resize split view" })).toBeNull());

    await vi.waitFor(() => expect(screen.getByRole("heading", { name: "Monday, October 5, 2026" })).toBeTruthy());
    expect(screen.getByTitle("Open Scratchpad")).toBeTruthy();
    expect(requireValue(screen.getByTitle("Open 2026-10-05").parentElement).classList.contains("active")).toBe(true);
    expect(appStore.currentView).toBe("day");
  });

  it.each(["separate", "close right"])("keeps the active left tab when collapsing via %s", async (action) => {
    await openScratchpadInSplit();
    if (action === "separate") {
      await fireEvent.contextMenu(requireValue(screen.getByTitle("Open Scratchpad")));
      await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Separate split view" })));
    } else {
      await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Close Scratchpad" })));
    }
    await vi.waitFor(() => expect(screen.queryByRole("separator", { name: "Resize split view" })).toBeNull());

    expect(screen.queryByText("No tabs open")).toBeNull();
    expect(requireValue(screen.getByTitle("Open Todo").parentElement).classList.contains("active")).toBe(true);
    await vi.waitFor(() => expect(appStore.currentView).toBe("todo"));
  });
});
