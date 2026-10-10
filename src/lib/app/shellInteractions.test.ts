import { requireValue } from "$lib/shared/testing/testHelpers.ts";
import { headerProps } from "./componentTestProps.ts";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { tick } from "svelte";
import AppHeader from "./AppHeader.svelte";
import AppSidebar from "./AppSidebar.svelte";
import WorkspaceTabs from "./WorkspaceTabs.svelte";
import SettingsPanel from "./SettingsPanel.svelte";
import SettingsDialog from "./SettingsDialog.svelte";
import HelpDialog from "./HelpDialog.svelte";
import StatusToast from "./StatusToast.svelte";
import FileTree from "$lib/shared/components/FileTree.svelte";
import ContextMenu from "$lib/shared/components/ContextMenu.svelte";
import ActivityRow from "$lib/features/daily/components/ActivityRow.svelte";
import SessionCard from "$lib/features/daily/components/SessionCard.svelte";
import DailyPanel from "$lib/features/daily/components/DailyPanel.svelte";
import DailyHeader from "$lib/features/daily/components/DailyHeader.svelte";
import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
import AddSessionForm from "$lib/features/daily/components/AddSessionForm.svelte";
import PlanSection from "$lib/features/weekly/components/PlanSection.svelte";
import ActualSection from "$lib/features/weekly/components/ActualSection.svelte";
import WeekPanel from "$lib/features/weekly/components/WeekPanel.svelte";
import ObjectiveRow from "$lib/features/weekly/components/ObjectiveRow.svelte";
import TodoPanel from "$lib/features/todo/components/TodoPanel.svelte";
import TodoToolbar from "$lib/features/todo/components/TodoToolbar.svelte";
import { todoFoldStore } from "$lib/features/todo/todoFolding.svelte.ts";
import { todoUiState } from "$lib/features/todo/todoUiState.svelte.ts";
import { todoStore } from "$lib/features/todo/todoStore.svelte.ts";
import { dailyStore } from "$lib/features/daily/dailyStore.svelte.ts";
import { weekStore } from "$lib/features/weekly/weekStore.svelte.ts";
import { workspaceStore } from "./workspaceStore.svelte.ts";
import { appStore } from "./appStore.svelte.ts";
import { subjectHistoryStore } from "./subjectHistoryStore.svelte.ts";
import { sessionHistoryStore } from "./sessionHistoryStore.svelte.ts";
import { scratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.ts";
import { formatDate, getWeekDescriptor } from "$lib/shared/services/logWorkspaceService.ts";
import * as logWorkspaceService from "$lib/shared/services/logWorkspaceService.ts";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openPath } from "@tauri-apps/plugin-opener";
import { EditorView } from "@codemirror/view";

import { installInteractionTestSetup } from './interactionTestSetup.ts';

installInteractionTestSetup();

describe("application navigation", () => {
  it("opens weekly and daily files from the file tree", async () => {
    const week = { path: "week", name: "2026w26", indexPath: "week/index.md", days: [{name:"2026-06-22", path: "week/day.md", date: "2026-06-22" }] };
    const onSelectWeek = vi.fn();
    const onSelectDay = vi.fn();
    render(FileTree, { weeks: [week], selectedPath: "", onSelectWeek, onSelectDay });
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: /Weekly index/ })));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: /2026-06-22/ })));
    expect(onSelectWeek).toHaveBeenCalledWith(week);
    expect(onSelectDay).toHaveBeenCalledWith(week.days[0], week);
  });

  it("opens week-folder actions from a right click", async () => {
    const week = { path: "week", name: "2026w26", indexPath: "week/index.md", days: [] };
    const onOpenWeekContextMenu = vi.fn();
    render(FileTree, {
      weeks: [week],
      selectedPath: "",
      onSelectWeek: vi.fn(),
      onSelectDay: vi.fn(),
      onOpenWeekContextMenu
    });

    await fireEvent.contextMenu(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "2026w26" })), {
      clientX: 40,
      clientY: 70
    });

    expect(onOpenWeekContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({ clientX: 40, clientY: 70 }),
      week
    );
  });

  it("offers safe week actions and only exposes conversion in Personal mode", async () => {
    const week = { path: "week", name: "2026w26", indexPath: "week/index.md", days: [] };
    workspaceStore.weeks = [week];
    appStore.frontmatterMode = "personal";
    const onRepairWeek = vi.fn();
    const onConvertWeek = vi.fn();
    const onDeleteWeek = vi.fn();
    render(AppSidebar, {
      open: true,
      selectedPath: "",
      onSelectWeek: vi.fn(),
      onSelectDay: vi.fn(),
      onRepairWeek,
      onConvertWeek,
      onDeleteWeek
    });

    await fireEvent.contextMenu(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "2026w26" })), {
      clientX: 40,
      clientY: 70
    });

    expect(screen.getByRole("menu", { name: "2026w26 actions" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Check/repair week" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Convert to personal" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Delete week…" })).toBeTruthy();
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Convert to personal" })));
    expect(onConvertWeek).toHaveBeenCalledWith(week);

    await fireEvent.contextMenu(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "2026w26" })));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Delete week…" })));
    expect(onDeleteWeek).toHaveBeenCalledWith(week);

    appStore.frontmatterMode = "off";
    await fireEvent.contextMenu(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "2026w26" })));
    expect(screen.queryByRole("menuitem", { name: "Convert to personal" })).toBeNull();
  });
});
describe("window controls", () => {
  it("emits minimize, maximize, and close actions from the title bar", async () => {
    const onShrinkApp = vi.fn();
    const onMaximizeApp = vi.fn();
    const onCloseApp = vi.fn();
    render(AppHeader, {...headerProps(),
      dragEnabled: true, layerMode: "normal", title: "Todo", showModeMenu: false,
      onToggleSidebar: vi.fn(), onToggleModeMenu: vi.fn(), onSelectMode: vi.fn(), onToggleSettings: vi.fn(),
      onShrinkApp, onMaximizeApp, onCloseApp
    });
    await fireEvent.click(requireValue(screen.getByTitle("Minimize")));
    await fireEvent.click(requireValue(screen.getByTitle("Maximize")));
    await fireEvent.click(requireValue(screen.getByTitle("Close")));
    expect(onShrinkApp).toHaveBeenCalledOnce();
    expect(onMaximizeApp).toHaveBeenCalledOnce();
    expect(onCloseApp).toHaveBeenCalledOnce();
  });

  it("renders an anchored mode menu and emits selection", async () => {
    const onSelectMode = vi.fn();
    render(AppHeader, {...headerProps(),
      dragEnabled: true, layerMode: "normal", title: "Todo", showModeMenu: true,
      onToggleSidebar: vi.fn(), onToggleModeMenu: vi.fn(), onSelectMode, onToggleSettings: vi.fn(),
      onShrinkApp: vi.fn(), onCloseApp: vi.fn()
    });
    expect(screen.getByRole("menu", { name: "Window mode" })).toBeTruthy();
    expect(screen.getByRole("menuitemradio", { name: /Normal Window/ }).getAttribute("aria-checked")).toBe("true");
    await fireEvent.click(requireValue(screen.getByRole("menuitemradio", { name: /Always on Top/ })));
    expect(onSelectMode).toHaveBeenCalledWith("top");
  });

  it("dismisses the mode menu outside and with Escape", async () => {
    const onDismissModeMenu = vi.fn();
    render(AppHeader, {...headerProps(),
      dragEnabled: true, layerMode: "normal", title: "Todo", showModeMenu: true,
      onToggleSidebar: vi.fn(), onToggleModeMenu: vi.fn(), onDismissModeMenu, onSelectMode: vi.fn(), onToggleSettings: vi.fn(),
      onShrinkApp: vi.fn(), onMaximizeApp: vi.fn(), onCloseApp: vi.fn()
    });
    const trigger = screen.getByTitle("Window layer mode");
    await fireEvent.pointerDown(requireValue(document.body));
    expect(onDismissModeMenu).toHaveBeenCalledOnce();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismissModeMenu).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(trigger);
  });

  it("opens compact File and View menus and emits shell actions", async () => {
    const onCreateNextWeek = vi.fn();
    const onOpenView = vi.fn();
    render(AppHeader, {...headerProps(),
      dragEnabled: true,
      layerMode: "normal",
      title: "Todo",
      currentView: "todo",
      sidebarOpen: true,
      showModeMenu: false,
      onToggleSidebar: vi.fn(),
      onToggleModeMenu: vi.fn(),
      onSelectMode: vi.fn(),
      onToggleSettings: vi.fn(),
      onCreateNextWeek,
      onOpenView,
      onShrinkApp: vi.fn(),
      onMaximizeApp: vi.fn(),
      onCloseApp: vi.fn()
    });

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "File" })));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Create Next Week" })));
    expect(onCreateNextWeek).toHaveBeenCalledOnce();

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "View" })));
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Todo" }).disabled).toBe(true);
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Scratchpad" })));
    expect(onOpenView).toHaveBeenCalledWith("scratchpad");

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "View" })));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Current Week" })));
    expect(onOpenView).toHaveBeenCalledWith("week");
  });

  it("opens fixed Scratchpad and Todo entries from the sidebar in that order", async () => {
    const onSelectScratchpad = vi.fn();
    const onSelectTodo = vi.fn();
    render(AppSidebar, {
      open: true,
      currentView: "todo",
      selectedPath: "",
      onSelectScratchpad,
      onSelectTodo,
      onSelectWeek: vi.fn(),
      onSelectDay: vi.fn()
    });

    const primaryViews = screen.getByRole("navigation", { name: "Primary views" });
    expect(within(requireValue(primaryViews)).getAllByRole("button").map((button) => requireValue(button.textContent).trim()))
      .toEqual(["Scratchpad", "Todo"]);

    await fireEvent.click(requireValue(within(requireValue(primaryViews)).getByRole<HTMLButtonElement>("button", { name: "Scratchpad" })));
    await fireEvent.click(requireValue(within(requireValue(primaryViews)).getByRole<HTMLButtonElement>("button", { name: "Todo" })));
    expect(onSelectScratchpad).toHaveBeenCalledOnce();
    expect(onSelectTodo).toHaveBeenCalledOnce();
  });

  it("opens the active scratchpad Markdown from the sidebar action", async () => {
    appStore.currentView = "scratchpad";
    scratchpadStore.path = "C:\\Tracker\\scratchpad.md";
    scratchpadStore.loaded = true;
    render(AppSidebar, {
      open: true,
      currentView: "scratchpad",
      selectedPath: scratchpadStore.path,
      onSelectScratchpad: vi.fn(),
      onSelectWeek: vi.fn(),
      onSelectDay: vi.fn()
    });

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Scratchpad" }).getAttribute("aria-current")).toBe("page");
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Open active file in system editor" })));

    expect(openPath).toHaveBeenCalledWith("C:\\Tracker\\scratchpad.md");
  });

  it("exposes stateful sidebar and history controls", async () => {
    const onBack = vi.fn();
    const onForward = vi.fn();
    render(AppHeader, {...headerProps(),
      dragEnabled: true,
      layerMode: "normal",
      title: "Daily log",
      currentView: "day",
      sidebarOpen: false,
      showModeMenu: false,
      canGoBack: true,
      canGoForward: false,
      onToggleSidebar: vi.fn(),
      onBack,
      onForward,
      onToggleModeMenu: vi.fn(),
      onSelectMode: vi.fn(),
      onToggleSettings: vi.fn(),
      onShrinkApp: vi.fn(),
      onMaximizeApp: vi.fn(),
      onCloseApp: vi.fn()
    });

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Show sidebar" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Settings" })).toHaveLength(1);
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Back" })));
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Forward" }).disabled).toBe(true);
  });

  it("renders Settings and Help as dismissible overlays", async () => {
    const closeSettings = vi.fn();
    render(SettingsDialog, {
      dragEnabled: true,
      autostartEnabled: false,
      onToggleDrag: vi.fn(),
      onToggleAutostart: vi.fn(),
      onClose: closeSettings
    });
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Close Settings" })));
    expect(closeSettings).toHaveBeenCalledOnce();

    cleanup();
    const closeHelp = vi.fn();
    render(HelpDialog, { onClose: closeHelp });
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy();
    expect(screen.getByText("Back and Forward follow your navigation history. Page Up and Page Down move through files in sidebar order.")).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(closeHelp).toHaveBeenCalledOnce();
  });

  it("renders transient app status outside the title bar", () => {
    render(StatusToast, { message: "Created 8 files across 1 week" });
    expect(screen.getByRole("status").textContent).toContain("Created 8 files across 1 week");
  });
});

describe("shared context menu behavior", () => {
  it("owns standard outside-click, Escape, scroll, and wheel dismissal when requested", async () => {
    const onDismiss = vi.fn();
    render(ContextMenu, {
      items: [{ label: "Example", onclick: vi.fn() }],
      ariaLabel: "Example actions",
      onDismiss
    });

    const menu = screen.getByRole("menu", { name: "Example actions" });
    await fireEvent.pointerDown(requireValue(menu));
    expect(onDismiss).not.toHaveBeenCalled();

    await fireEvent.pointerDown(requireValue(document.body));
    await fireEvent.keyDown(window, { key: "Escape" });
    await fireEvent.scroll(window);
    await fireEvent.wheel(window);

    expect(onDismiss).toHaveBeenCalledTimes(4);
  });
});

describe("workspace tab actions", () => {
  const tabs = [
    { id: "todo", title: "Todo", view: "todo" as const, path: "" },
    { id: "scratchpad", title: "Scratchpad", view: "scratchpad" as const, path: "scratchpad.md" }
  ];

  it("marks an unfocused pane's selected tab without changing the tab bar", () => {
    const { container } = render(WorkspaceTabs, { tabs, activeId: "todo", focused: false });
    const tabBar = requireValue(container.querySelector<HTMLElement>(".workspace-tabs"));
    expect(tabBar.classList.contains("inactive")).toBe(true);
    expect(tabBar.querySelector<HTMLElement>(".tab.active")).toBeTruthy();
  });

  it("opens an inactive tab in the split pane from its context menu", async () => {
    const onSplit = vi.fn();
    render(WorkspaceTabs, { tabs, activeId: "todo", onSplit });

    await fireEvent.contextMenu(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Scratchpad" })));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Open in split view" })));

    expect(onSplit).toHaveBeenCalledWith(tabs[1]);
  });

  it("offers separate and close actions for a split-pane tab", async () => {
    const onSeparate = vi.fn();
    const onClose = vi.fn();
    render(WorkspaceTabs, { tabs, activeId: "todo", onSeparate, onClose });

    await fireEvent.contextMenu(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Todo" })));
    const separate = screen.getByRole<HTMLButtonElement>("menuitem", { name: "Separate split view" });
    expect(separate.querySelector<HTMLElement>("svg")).toBeTruthy();
    await fireEvent.click(requireValue(separate));
    expect(onSeparate).toHaveBeenCalledOnce();

    await fireEvent.contextMenu(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Todo" })));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Close tab" })));
    expect(onClose).toHaveBeenCalledWith(tabs[0]);
  });

  it("offers an explicit move action for a tab in the left pane", async () => {
    const onMoveToRight = vi.fn();
    render(WorkspaceTabs, { tabs, activeId: "todo", onMoveToRight });

    await fireEvent.contextMenu(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Todo" })));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Move to right pane" })));

    expect(onMoveToRight).toHaveBeenCalledWith(tabs[0]);
  });

  it("replaces the split action with explicit pane targets in the sidebar", async () => {
    const onOpenScratchpadInPane = vi.fn();
    render(AppSidebar, {
      open: true,
      currentView: "todo",
      selectedPath: "",
      splitView: true,
      onSelectScratchpad: vi.fn(),
      onSelectTodo: vi.fn(),
      onSelectWeek: vi.fn(),
      onSelectDay: vi.fn(),
      onOpenScratchpadInPane
    });

    await fireEvent.contextMenu(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Scratchpad" })));
    expect(screen.queryByRole("menuitem", { name: "Open in split view" })).toBeNull();
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Open at right pane" })));

    expect(onOpenScratchpadInPane).toHaveBeenCalledWith("right");
  });
});
