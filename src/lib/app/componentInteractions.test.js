// @vitest-environment jsdom
// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { tick } from "svelte";
import MainTabs from "./MainTabs.svelte";
import AppHeader from "./AppHeader.svelte";
import AppSidebar from "./AppSidebar.svelte";
import SettingsPanel from "./SettingsPanel.svelte";
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
import { todoFoldStore } from "$lib/features/todo/todoFolding.svelte.js";
import { todoUiState } from "$lib/features/todo/todoUiState.svelte.js";
import { todoStore } from "$lib/features/todo/todoStore.svelte.js";
import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
import { workspaceStore } from "./workspaceStore.svelte.js";
import { appStore } from "./appStore.svelte.js";
import { subjectHistoryStore } from "./subjectHistoryStore.svelte.js";
import { sessionHistoryStore } from "./sessionHistoryStore.svelte.js";
import { formatDate, getWeekDescriptor } from "$lib/shared/services/logWorkspaceService.js";
import * as logWorkspaceService from "$lib/shared/services/logWorkspaceService.js";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { EditorView } from "@codemirror/view";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: vi.fn(),
  writeText: vi.fn()
}));

beforeEach(() => {
  readText.mockReset();
  writeText.mockReset();
  readText.mockResolvedValue("");
  writeText.mockResolvedValue();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  workspaceStore.unavailable = false;
  workspaceStore.weeks = [];
  workspaceStore.todoExists = false;
  appStore.logsRootPath = "";
  appStore.filePath = "";
  appStore.frontmatterMode = "off";
  appStore.statusMessage = "";
  appStore.currentView = "todo";
  todoStore.fileMissing = false;
  dailyStore.path = "";
  dailyStore.date = "";
  dailyStore.loaded = false;
  dailyStore.sessions = [];
  weekStore.path = "";
  weekStore.loaded = false;
  weekStore.objectives = [];
  weekStore.plan = [];
  weekStore.actual = [];
  subjectHistoryStore.history = { subjects: {} };
  subjectHistoryStore.loaded = false;
  subjectHistoryStore.rebuilding = false;
  sessionHistoryStore.history = { sessions: {} };
  sessionHistoryStore.loaded = false;
  sessionHistoryStore.rebuilding = false;
  todoFoldStore.expandAll();
  todoFoldStore.setFoldableTodoIds([]);
  todoUiState.showTodoNumbers = false;
  todoUiState.clearSelection();
});

describe("application navigation", () => {
  it("changes the main view from the tab bar", async () => {
    const onSelect = vi.fn();
    render(MainTabs, { currentView: "todo", onSelect });
    await fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(onSelect).toHaveBeenCalledWith("day");
  });

  it("opens weekly and daily files from the file tree", async () => {
    const week = { path: "week", name: "2026w26", indexPath: "week/index.md", days: [{ path: "week/day.md", date: "2026-06-22" }] };
    const onSelectWeek = vi.fn();
    const onSelectDay = vi.fn();
    render(FileTree, { weeks: [week], selectedPath: "", onSelectWeek, onSelectDay });
    await fireEvent.click(screen.getByRole("button", { name: /Weekly index/ }));
    await fireEvent.click(screen.getByRole("button", { name: /2026-06-22/ }));
    expect(onSelectWeek).toHaveBeenCalledWith(week);
    expect(onSelectDay).toHaveBeenCalledWith(week.days[0], week);
  });
});
describe("window controls", () => {
  it("emits minimize, maximize, and close actions from the title bar", async () => {
    const onShrinkApp = vi.fn();
    const onMaximizeApp = vi.fn();
    const onCloseApp = vi.fn();
    render(AppHeader, {
      dragEnabled: true, layerMode: "normal", statusMessage: "", title: "Todo", showModeMenu: false,
      onToggleSidebar: vi.fn(), onToggleModeMenu: vi.fn(), onSelectMode: vi.fn(), onToggleSettings: vi.fn(),
      onShrinkApp, onMaximizeApp, onCloseApp
    });
    await fireEvent.click(screen.getByTitle("Minimize"));
    await fireEvent.click(screen.getByTitle("Maximize"));
    await fireEvent.click(screen.getByTitle("Close"));
    expect(onShrinkApp).toHaveBeenCalledOnce();
    expect(onMaximizeApp).toHaveBeenCalledOnce();
    expect(onCloseApp).toHaveBeenCalledOnce();
  });

  it("renders an anchored mode menu and emits selection", async () => {
    const onSelectMode = vi.fn();
    render(AppHeader, {
      dragEnabled: true, layerMode: "normal", statusMessage: "", title: "Todo", showModeMenu: true,
      onToggleSidebar: vi.fn(), onToggleModeMenu: vi.fn(), onSelectMode, onToggleSettings: vi.fn(),
      onShrinkApp: vi.fn(), onCloseApp: vi.fn()
    });
    expect(screen.getByRole("menu", { name: "Window mode" })).toBeTruthy();
    expect(screen.getByRole("menuitemradio", { name: /Normal Window/ }).getAttribute("aria-checked")).toBe("true");
    await fireEvent.click(screen.getByRole("menuitemradio", { name: /Always on Top/ }));
    expect(onSelectMode).toHaveBeenCalledWith("top");
  });

  it("dismisses the mode menu outside and with Escape", async () => {
    const onDismissModeMenu = vi.fn();
    render(AppHeader, {
      dragEnabled: true, layerMode: "normal", statusMessage: "", title: "Todo", showModeMenu: true,
      onToggleSidebar: vi.fn(), onToggleModeMenu: vi.fn(), onDismissModeMenu, onSelectMode: vi.fn(), onToggleSettings: vi.fn(),
      onShrinkApp: vi.fn(), onMaximizeApp: vi.fn(), onCloseApp: vi.fn()
    });
    const trigger = screen.getByTitle("Window layer mode");
    await fireEvent.pointerDown(document.body);
    expect(onDismissModeMenu).toHaveBeenCalledOnce();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismissModeMenu).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(trigger);
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
    await fireEvent.pointerDown(menu);
    expect(onDismiss).not.toHaveBeenCalled();

    await fireEvent.pointerDown(document.body);
    await fireEvent.keyDown(window, { key: "Escape" });
    await fireEvent.scroll(window);
    await fireEvent.wheel(window);

    expect(onDismiss).toHaveBeenCalledTimes(4);
  });
});

describe("logger editing", () => {
  it("renders and edits subjects as individual pills", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust", "programming"], onChange, variant: "badge" });

    expect(screen.getByRole("button", { name: "rust" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "programming" })).toBeTruthy();

    const addInput = screen.getByRole("textbox", { name: "Add subject" });
    await fireEvent.input(addInput, { target: { value: "testing" } });
    await fireEvent.keyDown(addInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["rust", "programming", "testing"]);

    await fireEvent.click(screen.getByRole("button", { name: "rust" }));
    const editInput = screen.getByRole("textbox", { name: "Edit subject rust" });
    await fireEvent.input(editInput, { target: { value: "backend" } });
    await fireEvent.keyDown(editInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["backend", "programming"]);
  });

  it("commits subject additions with comma and Tab", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust"], onChange, variant: "badge" });
    const addInput = screen.getByRole("textbox", { name: "Add subject" });

    await fireEvent.input(addInput, { target: { value: "cli" } });
    await fireEvent.keyDown(addInput, { key: "," });
    expect(onChange).toHaveBeenCalledWith(["rust", "cli"]);

    await fireEvent.input(addInput, { target: { value: "web" } });
    await fireEvent.keyDown(addInput, { key: "Tab" });
    expect(onChange).toHaveBeenCalledWith(["rust", "web"]);
  });

  it("rejects invalid and duplicate subject additions", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust"], onChange, variant: "badge" });
    const addInput = screen.getByRole("textbox", { name: "Add subject" });

    await fireEvent.input(addInput, { target: { value: "bad subject" } });
    await fireEvent.keyDown(addInput, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Invalid or duplicate subject")).toBeTruthy();

    await fireEvent.input(addInput, { target: { value: "RUST" } });
    await fireEvent.keyDown(addInput, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes subjects but prevents empty subject lists", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust", "test"], onChange, variant: "badge" });
    await fireEvent.click(screen.getByRole("button", { name: "Remove test" }));
    expect(onChange).toHaveBeenCalledWith(["rust"]);

    cleanup();
    const singleChange = vi.fn();
    render(SubjectInput, { subjects: ["rust"], onChange: singleChange, variant: "badge" });
    expect(screen.queryByRole("button", { name: "Remove rust" })).toBeNull();
    const addInput = screen.getByRole("textbox", { name: "Add subject" });
    await fireEvent.keyDown(addInput, { key: "Backspace" });
    expect(singleChange).not.toHaveBeenCalled();
  });

  it("removes the previous subject with Backspace on an empty add input", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust", "test"], onChange, variant: "badge" });
    const addInput = screen.getByRole("textbox", { name: "Add subject" });

    await fireEvent.keyDown(addInput, { key: "Backspace" });

    expect(onChange).toHaveBeenCalledWith(["rust"]);
  });

  it("cancels subject add and edit input with Escape", async () => {
    const onChange = vi.fn();
    const onWindowEscape = vi.fn();
    window.addEventListener("keydown", onWindowEscape);
    render(SubjectInput, { subjects: ["rust", "test"], onChange, variant: "badge" });
    const addInput = screen.getByRole("textbox", { name: "Add subject" });

    await fireEvent.input(addInput, { target: { value: "cli" } });
    await fireEvent.keyDown(addInput, { key: "Escape" });
    expect(addInput.value).toBe("");
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole("button", { name: "rust" }));
    await fireEvent.keyDown(screen.getByRole("textbox", { name: "Edit subject rust" }), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Edit subject rust" })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(onWindowEscape).not.toHaveBeenCalled();
    window.removeEventListener("keydown", onWindowEscape);
  });

  it("cancels an empty pill edit before starting a new pill", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["general"], onChange, variant: "badge" });

    await fireEvent.click(screen.getByRole("button", { name: "general" }));
    const editInput = screen.getByRole("textbox", { name: "Edit subject general" });
    await fireEvent.input(editInput, { target: { value: "" } });

    const addInput = screen.getByRole("textbox", { name: "Add subject" });
    await fireEvent.focus(addInput);
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(screen.queryByRole("textbox", { name: "Edit subject general" })).toBeNull();
    expect(screen.getByRole("button", { name: "general" })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.input(addInput, { target: { value: "programming" } });
    await fireEvent.keyDown(addInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["general", "programming"]);
  });

  it("restores an existing pill when an empty edit loses focus", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["general"], onChange, variant: "badge" });

    await fireEvent.click(screen.getByRole("button", { name: "general" }));
    const editInput = screen.getByRole("textbox", { name: "Edit subject general" });
    await fireEvent.input(editInput, { target: { value: "" } });
    await fireEvent.blur(editInput);

    expect(screen.queryByRole("textbox", { name: "Edit subject general" })).toBeNull();
    expect(screen.getByRole("button", { name: "general" })).toBeTruthy();
    expect(screen.queryByRole("listbox", { name: "Subject suggestions" })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("suggests subjects while adding and editing pills", async () => {
    subjectHistoryStore.history = {
      subjects: {
        rust: { count: 4, last_used: "2026-07-03T00:00:00.000Z" },
        backend: { count: 2, last_used: "2026-07-02T00:00:00.000Z" },
        frontend: { count: 1, last_used: "2026-07-01T00:00:00.000Z" }
      }
    };
    const record = vi.spyOn(subjectHistoryStore, "record").mockResolvedValue(true);
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust"], onChange, variant: "badge" });

    const addInput = screen.getByRole("textbox", { name: "Add subject" });
    await fireEvent.focus(addInput);
    expect(screen.queryByRole("option", { name: "rust" })).toBeNull();
    expect(screen.getByRole("option", { name: "backend" })).toBeTruthy();

    await fireEvent.input(addInput, { target: { value: "front" } });
    expect(screen.queryByRole("option", { name: "backend" })).toBeNull();
    await fireEvent.click(screen.getByRole("option", { name: "frontend" }));

    expect(onChange).toHaveBeenCalledWith(["rust", "frontend"]);
    expect(record).toHaveBeenCalledWith(["frontend"]);
  });

  it("emits Daily activity edits", async () => {
    const onUpdate = vi.fn();
    render(ActivityRow, { activity: { subjects: ["rust"], minutes: 20, description: "Old" }, onUpdate, onDelete: vi.fn() });

    // Open minutes editor by clicking the badge
    await fireEvent.click(screen.getByLabelText("Edit minutes spent"));
    await fireEvent.input(screen.getByRole("textbox", { name: "Edit minutes spent" }), { target: { value: "45" } });

    // Open description editor by clicking the description text
    await fireEvent.click(screen.getByText("Old"));
    await fireEvent.input(screen.getByPlaceholderText("What happened?"), { target: { value: "New description" } });

    expect(onUpdate).toHaveBeenCalledWith({ minutes: 45 });
    expect(onUpdate).toHaveBeenCalledWith({ description: "New description" });

    await fireEvent.input(screen.getByRole("textbox", { name: "Add subject" }), { target: { value: "daily" } });
    await fireEvent.keyDown(screen.getByRole("textbox", { name: "Add subject" }), { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith({ subjects: ["rust", "daily"] });
  });

  it("emits Daily activity move actions", async () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    render(ActivityRow, {
      activity: { subjects: ["rust"], minutes: 20, description: "Move me" },
      canMoveUp: true,
      canMoveDown: true,
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onMoveUp,
      onMoveDown
    });

    await fireEvent.click(screen.getByRole("button", { name: "Move activity up" }));
    await fireEvent.click(screen.getByRole("button", { name: "Move activity down" }));

    expect(onMoveUp).toHaveBeenCalledOnce();
    expect(onMoveDown).toHaveBeenCalledOnce();
  });

  it("renders a session drag handle and emits pointer drag callbacks", async () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const onDragOver = vi.fn();
    const onDrop = vi.fn();
    render(SessionCard, {
      session: { id: "session-1", name: "Work", activities: [] },
      dragState: null,
      onAddActivity: vi.fn(),
      onUpdateActivity: vi.fn(),
      onDeleteActivity: vi.fn(),
      onMoveActivity: vi.fn(),
      onDeleteSession: vi.fn(),
      onRenameSession: vi.fn(),
      onDragStart,
      onDragOver,
      onDragLeave: vi.fn(),
      onDrop,
      onDragEnd
    });

    const handle = screen.getByRole("button", { name: "Reorder Work" });
    await fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    await fireEvent.pointerMove(window, { pointerId: 1, clientX: 0, clientY: 12 });
    await fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 12 });

    expect(onDragStart).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }));
    expect(onDragEnd).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }));
    expect(onDragOver).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("shows suggestions when renaming a daily session", async () => {
    const onRenameSession = vi.fn(() => true);
    render(SessionCard, {
      session: { id: "session-1", name: "Work", activities: [] },
      suggestions: [
        { name: "Deep Work", plannedThisWeek: true },
        { name: "Review", plannedThisWeek: false },
        { name: "Long renamed session", plannedThisWeek: false }
      ],
      existingSessions: ["Work", "Review"],
      dragState: null,
      onAddActivity: vi.fn(),
      onUpdateActivity: vi.fn(),
      onDeleteActivity: vi.fn(),
      onMoveActivity: vi.fn(),
      onDeleteSession: vi.fn(),
      onRenameSession,
      onDragStart: vi.fn(),
      onDragOver: vi.fn(),
      onDragLeave: vi.fn(),
      onDrop: vi.fn(),
      onDragEnd: vi.fn()
    });

    await fireEvent.click(screen.getByText("Work"));

    expect(screen.getByRole("option", { name: "Deep Work" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Long renamed session" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Review" })).toBeNull();

    await fireEvent.input(screen.getByDisplayValue("Work"), { target: { value: "long" } });
    expect(screen.queryByRole("option", { name: "Deep Work" })).toBeNull();
    await fireEvent.click(screen.getByRole("option", { name: "Long renamed session" }));

    expect(onRenameSession).toHaveBeenCalledWith("Long renamed session");
  });

  it("cancels a daily session rename with Escape", async () => {
    const onRenameSession = vi.fn(() => true);
    const onWindowEscape = vi.fn();
    window.addEventListener("keydown", onWindowEscape);
    render(SessionCard, {
      session: { id: "session-1", name: "Work", activities: [] },
      dragState: null,
      onAddActivity: vi.fn(), onUpdateActivity: vi.fn(), onDeleteActivity: vi.fn(),
      onMoveActivity: vi.fn(), onDeleteSession: vi.fn(), onRenameSession,
      onDragStart: vi.fn(), onDragOver: vi.fn(), onDragLeave: vi.fn(),
      onDrop: vi.fn(), onDragEnd: vi.fn()
    });

    await fireEvent.click(screen.getByText("Work"));
    const input = screen.getByDisplayValue("Work");
    await fireEvent.input(input, { target: { value: "Draft" } });
    await fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByDisplayValue("Draft")).toBeNull();
    expect(screen.getByText("Work")).toBeTruthy();
    expect(onRenameSession).not.toHaveBeenCalled();
    expect(onWindowEscape).not.toHaveBeenCalled();
    window.removeEventListener("keydown", onWindowEscape);
  });

  it("keeps daily session and activity context menus separate", async () => {
    dailyStore.loaded = true;
    dailyStore.date = "2026-07-19";
    dailyStore.sessions = [
      { id: "s1", name: "First session", activities: [
        { id: "a1", subjects: ["rust"], minutes: 20, description: "First activity" },
        { id: "a2", subjects: ["test"], minutes: 10, description: "Second activity" }
      ] },
      { id: "s2", name: "Second session", activities: [] }
    ];
    const moveSessionTo = vi.spyOn(dailyStore, "moveSessionTo").mockReturnValue(true);
    const moveActivity = vi.spyOn(dailyStore, "moveActivity").mockReturnValue(true);
    const removeActivity = vi.spyOn(dailyStore, "removeActivity").mockImplementation(() => {});

    render(DailyPanel);
    await fireEvent.contextMenu(screen.getByText("First session").closest(".session-card"));
    expect(screen.getByRole("menu", { name: "Session actions" })).toBeTruthy();
    expect(screen.queryByRole("menu", { name: "Activity actions" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Move Up" }).disabled).toBe(true);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Move Down" }));
    expect(moveSessionTo).toHaveBeenCalledWith("s1", "s2", "after");

    await fireEvent.contextMenu(screen.getByText("First activity").closest(".activity-card"));
    expect(screen.getByRole("menu", { name: "Activity actions" })).toBeTruthy();
    expect(screen.queryByRole("menu", { name: "Session actions" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Move Up" }).disabled).toBe(true);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Move Down" }));
    expect(moveActivity).toHaveBeenCalledWith("s1", "a1", "down");

    await fireEvent.contextMenu(screen.getByText("Second activity").closest(".activity-card"));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(removeActivity).toHaveBeenCalledWith("s1", "a2");
  });

  it("adds clipboard actions to daily session and activity editors", async () => {
    dailyStore.loaded = true;
    dailyStore.date = "2026-07-19";
    dailyStore.sessions = [{ id: "s1", name: "Session name", activities: [
      { id: "a1", subjects: ["rust"], minutes: 20, description: "Activity text" }
    ] }];
    vi.spyOn(dailyStore, "save").mockResolvedValue(true);

    render(DailyPanel);
    await fireEvent.click(screen.getByText("Session name"));
    const sessionInput = screen.getByDisplayValue("Session name");
    sessionInput.setSelectionRange(0, 7);
    await fireEvent.contextMenu(sessionInput);
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });

    await fireEvent.click(screen.getByText("Activity text"));
    const activityInput = screen.getByPlaceholderText("What happened?");
    activityInput.setSelectionRange(0, 8);
    await fireEvent.contextMenu(activityInput);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Cut" }));
    await vi.waitFor(() => expect(dailyStore.sessions[0].activities[0].description).toBe(" text"));
    expect(writeText).toHaveBeenCalledWith("Activity");
  });

  it("renders a zero-minute default when TimeInput has no minutes prop", async () => {
    const { default: TimeInput } = await import("$lib/shared/components/TimeInput.svelte");
    render(TimeInput, { onChange: vi.fn(), variant: "badge" });
    expect(screen.getByRole("button", { name: "Edit minutes spent" }).textContent.trim()).toBe("0m");
  });

  it("emits Weekly plan edits", async () => {
    const onUpdate = vi.fn();
    render(PlanSection, {
      plan: [{ id: "p1", day: "Mon", session: "Development", subjects: ["stale"], targetMinutes: 99, activities: [{ id: "a1", subjects: ["rust"], minutes: 60, description: "Build" }] }],
      onAdd: vi.fn(), onUpdate, onDelete: vi.fn()
    });
    await fireEvent.click(screen.getByRole("button", { name: "Development" }));
    await fireEvent.input(screen.getByPlaceholderText("What session?"), { target: { value: "Review" } });
    expect(onUpdate).toHaveBeenCalledWith("p1", { session: "Review" });
    expect(screen.getByText("60m")).toBeTruthy();
    expect(screen.getByText("rust")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Add subject" })).toBeNull();
  });

  it("edits unknown durations without conflating them with zero", async () => {
    const onUpdate = vi.fn();
    render(ActivityRow, {
      activity: { subjects: ["general"], minutes: null, description: "Estimate later" },
      onUpdate,
      onDelete: vi.fn()
    });

    const badge = screen.getByRole("button", { name: "Edit minutes spent" });
    expect(badge.textContent.trim()).toBe("?");
    await fireEvent.click(badge);
    const input = screen.getByRole("textbox", { name: "Edit minutes spent" });
    await fireEvent.input(input, { target: { value: "?" } });
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith({ minutes: null });
  });

  it("marks existing Daily totals as incomplete when durations are unknown", () => {
    render(DailyHeader, { date: "2026-07-25", totalMinutes: 100, unknownDurationCount: 1 });
    expect(screen.getByText("1h 40m+")).toBeTruthy();
    expect(screen.getByText("100 known minutes")).toBeTruthy();
  });

  it("marks Daily session subtotals as incomplete", () => {
    render(SessionCard, {
      session: {
        id: "session",
        name: "Work",
        activities: [
          { id: "known", subjects: ["rust"], minutes: 30, description: "Known" },
          { id: "unknown", subjects: ["test"], minutes: null, description: "Unknown" }
        ]
      }
    });
    expect(screen.getByText("30m+ / 2 activities")).toBeTruthy();
  });

  it("shares collapsed days between weekly plan and actual", async () => {
    weekStore.loaded = true;
    weekStore.descriptor = { year: 2026, week: 29, rangeLabel: "Jul 13 – Jul 19" };
    weekStore.plan = [{ id: "p1", day: "Mon", session: "Plan session", activities: [] }];
    weekStore.actual = [{ day: "Mon", session: "Actual session", subjects: [], actualMinutes: 30, activities: [] }];

    const { container } = render(WeekPanel);
    const collapseMonday = screen.getAllByRole("button", { name: "Collapse Mon" });
    expect(collapseMonday).toHaveLength(2);
    await fireEvent.click(collapseMonday[0]);

    expect(screen.queryByRole("button", { name: "Plan session" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open actual activities for Actual session" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Expand Mon" })).toHaveLength(2);
    expect(container.querySelector("#plan .week-board").style.gridTemplateColumns.startsWith("56px")).toBe(true);
    expect(container.querySelector("#actual .week-board").style.gridTemplateColumns.startsWith("56px")).toBe(true);

    await fireEvent.click(screen.getAllByRole("button", { name: "Expand Mon" })[1]);
    expect(screen.getByRole("button", { name: "Plan session" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open actual activities for Actual session" })).toBeTruthy();
  });

  it("keeps day counts and empty-day actions consistent in weekly columns", async () => {
    const onAdd = vi.fn();
    render(PlanSection, {
      plan: [
        { id: "p1", day: "Mon", session: "First", activities: [] },
        { id: "p2", day: "Mon", session: "Second", activities: [] }
      ],
      collapsedDays: [],
      toggleDay: vi.fn(),
      onAdd,
      onUpdate: vi.fn(),
      onDelete: vi.fn()
    });

    expect(screen.getByRole("button", { name: "Collapse Mon" }).textContent).toContain("2");
    expect(screen.getByRole("button", { name: "Collapse Tue" }).textContent).toContain("0");
    await fireEvent.click(screen.getByTitle("Add planned session to Tue"));
    expect(onAdd).toHaveBeenCalledWith("Tue");

    cleanup();
    render(ActualSection, {
      actual: [
        { day: "Mon", session: "First", subjects: [], actualMinutes: 10, activities: [] },
        { day: "Mon", session: "Second", subjects: [], actualMinutes: 20, activities: [] }
      ],
      collapsedDays: [],
      toggleDay: vi.fn(),
      onRefresh: vi.fn()
    });

    expect(screen.getByRole("button", { name: "Collapse Mon" }).textContent).toContain("2");
    expect(screen.getByRole("button", { name: "Collapse Tue" }).textContent).toContain("0");
    expect(screen.getAllByText("No records").length).toBeGreaterThan(0);
  });

  it("keeps one weekly day expanded", async () => {
    weekStore.loaded = true;
    weekStore.descriptor = { year: 2026, week: 29, rangeLabel: "Jul 13 – Jul 19" };

    render(WeekPanel);
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      await fireEvent.click(screen.getAllByRole("button", { name: `Collapse ${day}` })[0]);
    }
    await fireEvent.click(screen.getAllByRole("button", { name: "Collapse Sun" })[0]);

    expect(screen.getAllByRole("button", { name: /^Expand / })).toHaveLength(12);
    expect(screen.getAllByRole("button", { name: "Collapse Sun" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Collapse Sun" })[0].getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("button", { name: "Collapse Sun" })[0].disabled).toBe(true);
  });

  it("restores a weekly session name when Escape cancels editing", async () => {
    const entry = { id: "p1", day: "Mon", session: "Development", activities: [] };
    const onUpdate = vi.fn((id, patch) => Object.assign(entry, patch));
    const onWindowEscape = vi.fn();
    window.addEventListener("keydown", onWindowEscape);
    render(PlanSection, { plan: [entry], onAdd: vi.fn(), onUpdate, onDelete: vi.fn() });

    await fireEvent.click(screen.getByRole("button", { name: "Development" }));
    const input = screen.getByPlaceholderText("What session?");
    await fireEvent.input(input, { target: { value: "Draft" } });
    await fireEvent.keyDown(input, { key: "Escape" });

    expect(onUpdate).toHaveBeenLastCalledWith("p1", { session: "Development" });
    expect(screen.queryByPlaceholderText("What session?")).toBeNull();
    expect(screen.getByRole("button", { name: "Development" })).toBeTruthy();
    expect(onWindowEscape).not.toHaveBeenCalled();
    window.removeEventListener("keydown", onWindowEscape);
  });

  it("offers usage-ranked history when editing a weekly planned session", async () => {
    const entry = { id: "p1", day: "Mon", session: "Development", activities: [] };
    const onUpdate = vi.fn((id, patch) => Object.assign(entry, patch));
    render(PlanSection, {
      plan: [entry],
      suggestions: [
        { name: "Research", plannedThisWeek: false },
        { name: "Deep Work", plannedThisWeek: false }
      ],
      onAdd: vi.fn(), onUpdate, onDelete: vi.fn()
    });

    await fireEvent.click(screen.getByRole("button", { name: "Development" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Research", "Deep Work"]);
    expect(document.querySelector(".planned-marker")).toBeNull();

    const input = screen.getByPlaceholderText("What session?");
    await fireEvent.input(input, { target: { value: "deep" } });
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdate).toHaveBeenLastCalledWith("p1", { session: "Deep Work" });
    expect(screen.getByRole("button", { name: "Deep Work" })).toBeTruthy();
  });

  it("emits weekly plan drag moves across cards and day drop zones", async () => {
    const onMove = vi.fn();
    const onMoveToDay = vi.fn();
    const { container } = render(PlanSection, {
      plan: [
        { id: "p1", day: "Mon", session: "Development", subjects: ["rust"], targetMinutes: 60, activities: [] },
        { id: "p2", day: "Tue", session: "Review", subjects: ["general"], targetMinutes: 30, activities: [] }
      ],
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onMove,
      onMoveToDay,
      onAddActivity: vi.fn(),
      onUpdateActivity: vi.fn(),
      onDeleteActivity: vi.fn(),
      onMoveActivity: vi.fn()
    });

    const reviewCard = screen.getByRole("button", { name: "Review" }).closest("article");
    reviewCard.getBoundingClientRect = () => ({ top: 10, bottom: 50, height: 40, left: 0, right: 100, width: 100 });
    document.elementsFromPoint = vi.fn(() => [reviewCard]);

    const handle = screen.getByRole("button", { name: "Reorder Development" });
    await fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    await fireEvent.pointerMove(window, { pointerId: 1, clientX: 0, clientY: 45 });
    await tick();
    expect(handle.closest("article").classList.contains("dragging")).toBe(true);
    expect(reviewCard.classList.contains("drop-after")).toBe(true);
    await fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 45 });
    expect(onMove).toHaveBeenCalledWith("p1", "p2", "after");

    const friColumn = [...container.querySelectorAll(".day-column")][4];
    const friTarget = friColumn.querySelector(".day-drop-target");
    document.elementsFromPoint = vi.fn(() => [friTarget]);
    await fireEvent.pointerDown(handle, { button: 0, pointerId: 2, clientX: 0, clientY: 0 });
    await fireEvent.pointerMove(window, { pointerId: 2, clientX: 0, clientY: 20 });
    await tick();
    const friZone = friColumn.querySelector(".day-drop-zone");
    expect(friZone.classList.contains("active")).toBe(true);
    await fireEvent.pointerUp(window, { pointerId: 2, clientX: 0, clientY: 20 });
    expect(onMoveToDay).toHaveBeenCalledWith("p1", "Fri");
  });

  it("opens weekly plan details and emits planned activity actions", async () => {
    const onAddActivity = vi.fn();
    const onMoveActivity = vi.fn();
    render(PlanSection, {
      plan: [{
        id: "p1",
        day: "Mon",
        session: "Development",
        subjects: ["rust"],
        targetMinutes: 60,
        activities: [{ id: "a1", subjects: ["rust"], minutes: 30, description: "Draft tests" }]
      }],
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onMove: vi.fn(),
      onAddActivity,
      onUpdateActivity: vi.fn(),
      onDeleteActivity: vi.fn(),
      onMoveActivity
    });

    await fireEvent.click(screen.getByRole("button", { name: "Open planned activities for Development" }));
    expect(screen.getByRole("dialog", { name: "Planned activities for Development" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Add activity" }));
    expect(onAddActivity).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("button", { name: "Move planned activity up" }).disabled).toBe(true);
  });

  it("marks Weekly Planned card and detail totals as incomplete", async () => {
    render(PlanSection, {
      plan: [{
        id: "p1",
        day: "Mon",
        session: "Development",
        activities: [
          { id: "known", subjects: ["rust"], minutes: 30, description: "Known" },
          { id: "unknown", subjects: ["test"], minutes: null, description: "Unknown" }
        ]
      }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(),
      onAddActivity: vi.fn(), onUpdateActivity: vi.fn(), onDeleteActivity: vi.fn(), onMoveActivity: vi.fn()
    });

    const planCard = screen.getByRole("button", { name: "Open planned activities for Development" });
    expect(within(planCard.closest(".plan-card")).getByText("30m+")).toBeTruthy();
    await fireEvent.click(planCard);
    expect(screen.getByText("Mon / 30m+ / 2 activities")).toBeTruthy();
  });

  it("lets subject suggestions overflow weekly plan details while the backdrop scrolls", async () => {
    subjectHistoryStore.history = {
      subjects: { backend: { count: 2, last_used: "2026-07-02T00:00:00.000Z" } }
    };
    render(PlanSection, {
      plan: [{
        id: "p1", day: "Mon", session: "Development",
        activities: [{ id: "a1", subjects: ["rust"], minutes: 30, description: "Draft tests" }]
      }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(),
      onMove: vi.fn(), onMoveToDay: vi.fn(), onAddActivity: vi.fn(),
      onUpdateActivity: vi.fn(), onDeleteActivity: vi.fn(), onMoveActivity: vi.fn()
    });

    await fireEvent.click(screen.getByRole("button", { name: "Open planned activities for Development" }));
    await fireEvent.click(screen.getByRole("button", { name: "rust" }));

    const subjectEditor = screen.getByRole("textbox", { name: "Edit subject rust" });
    const modal = subjectEditor.closest(".plan-modal");
    const backdrop = subjectEditor.closest(".modal-backdrop");
    expect(getComputedStyle(modal).overflow).toBe("visible");
    expect(getComputedStyle(backdrop).overflowY).toBe("auto");
  });

  it("closes weekly plan details with Escape and backdrop click", async () => {
    const props = {
      plan: [{
        id: "p1",
        day: "Mon",
        session: "Development",
        subjects: ["rust"],
        targetMinutes: 60,
        activities: [{ id: "a1", subjects: ["rust"], minutes: 30, description: "Draft tests" }]
      }],
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onMove: vi.fn(),
      onAddActivity: vi.fn(),
      onUpdateActivity: vi.fn(),
      onDeleteActivity: vi.fn(),
      onMoveActivity: vi.fn()
    };
    const view = render(PlanSection, props);

    await fireEvent.click(screen.getByRole("button", { name: "Open planned activities for Development" }));
    expect(screen.getByRole("dialog", { name: "Planned activities for Development" })).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Planned activities for Development" })).toBeNull();

    await view.rerender(props);
    await fireEvent.click(screen.getByRole("button", { name: "Open planned activities for Development" }));
    await fireEvent.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog", { name: "Planned activities for Development" })).toBeNull();
  });

  it("adds separate structure and clipboard actions to weekly planned activities", async () => {
    const onUpdateActivity = vi.fn();
    const onDeleteActivity = vi.fn();
    const onMoveActivity = vi.fn();
    render(PlanSection, {
      plan: [{
        id: "p1", day: "Mon", session: "Development",
        activities: [
          { id: "a1", subjects: ["rust"], minutes: 30, description: "First planned" },
          { id: "a2", subjects: ["test"], minutes: 20, description: "Second planned" }
        ]
      }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(),
      onMoveToDay: vi.fn(), onAddActivity: vi.fn(), onUpdateActivity,
      onDeleteActivity, onMoveActivity
    });

    await fireEvent.click(screen.getByRole("button", { name: "Open planned activities for Development" }));
    await fireEvent.contextMenu(screen.getByRole("button", { name: "First planned" }).closest(".planned-activity"));
    expect(screen.getByRole("menu", { name: "Planned activity actions" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Copy" })).toBeNull();
    await fireEvent.click(screen.getByRole("menuitem", { name: "Move Down" }));
    expect(onMoveActivity).toHaveBeenCalledWith("p1", "a1", "down");

    await fireEvent.click(screen.getByRole("button", { name: "First planned" }));
    const input = screen.getByPlaceholderText("Planned activity");
    input.setSelectionRange(0, 5);
    await fireEvent.contextMenu(input);
    expect(screen.getByRole("menuitem", { name: "Cut" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Planned activity actions" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Planned activities for Development" })).toBeTruthy();

    await fireEvent.contextMenu(screen.getByRole("button", { name: "Second planned" }).closest(".planned-activity"));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDeleteActivity).toHaveBeenCalledWith("p1", "a2");
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Planned activities for Development" })).toBeNull();
  });

  it("opens weekly actual read-only details and closes the modal", async () => {
    render(ActualSection, {
      actual: [{
        day: "Mon",
        session: "Development",
        subjects: ["rust", "test"],
        actualMinutes: 90,
        activities: [
          { description: "Draft tests", subjects: ["rust"], minutes: 60 },
          { description: "Review parser", subjects: ["test"], minutes: 30 }
        ]
      }],
      onRefresh: vi.fn()
    });

    await fireEvent.click(screen.getByRole("button", { name: "Open actual activities for Development" }));

    expect(screen.getByRole("dialog", { name: "Actual activities for Development" })).toBeTruthy();
    expect(screen.getByText("Mon / 90m / 2 activities")).toBeTruthy();
    expect(screen.getByText("Draft tests")).toBeTruthy();
    expect(screen.getByText("Review parser")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add activity" })).toBeNull();

    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Actual activities for Development" })).toBeNull();

    await fireEvent.click(screen.getByRole("button", { name: "Open actual activities for Development" }));
    await fireEvent.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog", { name: "Actual activities for Development" })).toBeNull();
  });

  it("marks Weekly Actual card and detail totals as incomplete", async () => {
    render(ActualSection, {
      actual: [{
        day: "Mon",
        session: "Development",
        subjects: ["rust"],
        actualMinutes: 30,
        unknownDurationCount: 1,
        activities: [
          { description: "Known", subjects: ["rust"], minutes: 30 },
          { description: "Unknown", subjects: ["test"], minutes: null }
        ]
      }],
      onRefresh: vi.fn()
    });

    const actualCard = screen.getByRole("button", { name: "Open actual activities for Development" });
    expect(within(actualCard).getByText("30m+")).toBeTruthy();
    await fireEvent.click(actualCard);
    expect(screen.getByText("Mon / 30m+ / 2 activities")).toBeTruthy();
    expect(screen.getByText("?")).toBeTruthy();
  });

  it("shows the mixed Weekly Planned section total", () => {
    render(PlanSection, {
      plan: [{
        id: "p1", day: "Mon", session: "Development",
        activities: [
          { id: "a1", subjects: ["rust"], minutes: 60, description: "Known" },
          { id: "a2", subjects: ["test"], minutes: null, description: "Unknown" }
        ]
      }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(),
      onMoveToDay: vi.fn(), onAddActivity: vi.fn(), onUpdateActivity: vi.fn(),
      onDeleteActivity: vi.fn(), onMoveActivity: vi.fn()
    });

    expect(screen.getByLabelText("Weekly planned total: 1h+")).toBeTruthy();
  });

  it("shows the mixed Weekly Actual section total", () => {
    render(ActualSection, {
      actual: [{
        day: "Mon",
        session: "Development",
        subjects: ["rust"],
        actualMinutes: 90,
        unknownDurationCount: 1,
        activities: []
      }],
      onRefresh: vi.fn()
    });

    expect(screen.getByLabelText("Weekly actual total: 1h 30m+")).toBeTruthy();
  });

  it("shows filtered weekly session suggestions when adding a daily session", async () => {
    const onAdd = vi.fn(() => true);
    render(AddSessionForm, {
      suggestions: [
        { name: "Deep Work", plannedThisWeek: true },
        { name: "Long planned session name that should be visible on hover", plannedThisWeek: false },
        { name: "Review", plannedThisWeek: false }
      ],
      existingSessions: ["Review"],
      onAdd
    });

    await fireEvent.click(screen.getByRole("button", { name: "Add session" }));
    expect(screen.getByRole("option", { name: "Deep Work" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Deep Work" }).querySelector(".planned-marker")?.textContent).toBe("*");
    expect(screen.getByRole("option", { name: "Deep Work" }).querySelector(".planned-marker")?.textContent).toBe("*");
    expect(screen.getByRole("option", { name: "Long planned session name that should be visible on hover" }).getAttribute("title")).toBe("Long planned session name that should be visible on hover");
    expect(screen.queryByRole("option", { name: "Review" })).toBeNull();

    await fireEvent.input(screen.getByPlaceholderText("Session name..."), { target: { value: "long" } });
    expect(screen.queryByRole("option", { name: "Deep Work" })).toBeNull();
    expect(screen.getByRole("option", { name: "Long planned session name that should be visible on hover" })).toBeTruthy();
  });

  it("preserves suggestion casing for exact typed session matches", async () => {
    const onAdd = vi.fn(() => true);
    render(AddSessionForm, { suggestions: [{ name: "Deep Work", plannedThisWeek: true }], existingSessions: [], onAdd });

    await fireEvent.click(screen.getByRole("button", { name: "Add session" }));
    await fireEvent.input(screen.getByPlaceholderText("Session name..."), { target: { value: "deep work" } });
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onAdd).toHaveBeenCalledWith("Deep Work");
  });

  it("merges weekly planned sessions before session history in the daily add form", async () => {
    dailyStore.loaded = true;
    dailyStore.date = "2026-07-05";
    dailyStore.sessions = [{ id: "session-existing", name: "Existing", activities: [] }];
    weekStore.plan = [
      { id: "p1", day: "Sun", session: "Alpha", subjects: ["general"], targetMinutes: 0, activities: [] },
      { id: "p2", day: "Sun", session: "beta", subjects: ["general"], targetMinutes: 0, activities: [] }
    ];
    sessionHistoryStore.history = {
      sessions: {
        alpha: { actual_count: 9, planned_count: 0, last_used: "2026-07-05T00:00:00.000Z" },
        Gamma: { actual_count: 5, planned_count: 0, last_used: "2026-07-04T00:00:00.000Z" },
        Existing: { actual_count: 4, planned_count: 0, last_used: "2026-07-04T00:00:00.000Z" }
      }
    };

    render(DailyPanel);

    await fireEvent.click(screen.getByRole("button", { name: "Add session" }));
    const options = screen.getAllByRole("option").map((option) => option.textContent);

    expect(options).toEqual(["*Alpha", "*beta", "Gamma"]);
  });

  it("does not show a suggestions dropdown when no suggestions are available", async () => {
    render(AddSessionForm, { suggestions: [], existingSessions: [], onAdd: vi.fn(() => true) });

    await fireEvent.click(screen.getByRole("button", { name: "Add session" }));

    expect(screen.queryByRole("option")).toBeNull();
  });

  it("edits objective status and subjects without an origin control", async () => {
    const onUpdate = vi.fn();
    render(ObjectiveRow, {
      objective: { subjects: ["rust"], status: "open", description: "Ship", indent: 0 },
      onUpdate, onDelete: vi.fn()
    });
    expect(document.querySelector(".origin-badge")).toBeNull();

    await fireEvent.click(screen.getByLabelText("Status"));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Partial" }));

    expect(onUpdate).toHaveBeenCalledWith({ status: "partial" });

    await fireEvent.input(screen.getByRole("textbox", { name: "Add subject" }), { target: { value: "weekly" } });
    await fireEvent.keyDown(screen.getByRole("textbox", { name: "Add subject" }), { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith({ subjects: ["rust", "weekly"] });
  });

  it("renders objective indentation and uses Tab and Shift+Tab without leaving the editor", async () => {
    const onIndent = vi.fn();
    const onOutdent = vi.fn();
    const { container } = render(ObjectiveRow, {
      objective: { subjects: ["rust"], status: "open", description: "Nested", indent: 2 },
      onUpdate: vi.fn(), onDelete: vi.fn(), onIndent, onOutdent
    });

    expect(container.querySelector(".objective-card").style.marginLeft).toBe("48px");
    await fireEvent.click(screen.getByText("Nested"));
    const input = screen.getByPlaceholderText("Objective description");
    expect(document.activeElement).toBe(input);

    expect(await fireEvent.keyDown(input, { key: "Tab" })).toBe(false);
    expect(onIndent).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
    expect(await fireEvent.keyDown(input, { key: "Tab", shiftKey: true })).toBe(false);
    expect(onOutdent).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
  });

  it("folds and unfolds indented objective rows", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    render(ObjectivesSection, {
      objectives: [
        { id: "parent", subjects: ["general"], status: "open", description: "Parent", indent: 0 },
        { id: "child", subjects: ["general"], status: "open", description: "Child", indent: 1 },
        { id: "sibling", subjects: ["general"], status: "open", description: "Sibling", indent: 0 }
      ],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    expect(screen.getByText("Child")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Collapse objective" }));
    expect(screen.queryByText("Child")).toBeNull();
    expect(screen.getByText("Sibling")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Expand objective" }));
    expect(screen.getByText("Child")).toBeTruthy();
  });

  it("offers single-objective structure actions from the context menu", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    const onIndent = vi.fn();
    const onOutdent = vi.fn();
    const onMove = vi.fn();
    const onDelete = vi.fn();
    render(ObjectivesSection, {
      objectives: [
        { id: "first", subjects: [], status: "open", description: "First", indent: 0 },
        { id: "target", subjects: [], status: "open", description: "Target", indent: 1 },
        { id: "last", subjects: [], status: "open", description: "Last", indent: 0 }
      ],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete, onMove, onIndent, onOutdent
    });

    const targetRow = screen.getByText("Target").closest("article");
    await fireEvent.contextMenu(targetRow, { clientX: 40, clientY: 50 });
    expect(screen.getByRole("menu", { name: "Objective actions" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Copy" })).toBeNull();
    await fireEvent.click(screen.getByRole("menuitem", { name: "Indent" }));
    expect(onIndent).toHaveBeenCalledWith("target");
    expect(screen.queryByRole("menu", { name: "Objective actions" })).toBeNull();

    await fireEvent.contextMenu(targetRow);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Outdent" }));
    expect(onOutdent).toHaveBeenCalledWith("target");

    await fireEvent.contextMenu(targetRow);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Move Up" }));
    expect(onMove).toHaveBeenCalledWith("target", "up");

    await fireEvent.contextMenu(targetRow);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Move Down" }));
    expect(onMove).toHaveBeenCalledWith("target", "down");

    await fireEvent.contextMenu(targetRow);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("target");
  });

  it("disables unavailable objective context actions and closes with Escape", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    render(ObjectivesSection, {
      objectives: [{ id: "only", subjects: [], status: "open", description: "Only", indent: 0 }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    await fireEvent.contextMenu(screen.getByText("Only").closest("article"));
    expect(screen.getByRole("menuitem", { name: "Outdent" }).disabled).toBe(true);
    expect(screen.getByRole("menuitem", { name: "Move Up" }).disabled).toBe(true);
    expect(screen.getByRole("menuitem", { name: "Move Down" }).disabled).toBe(true);
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Objective actions" })).toBeNull();
  });

  it("adds focus-preserving text actions to editable objective targets", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    render(ObjectivesSection, {
      objectives: [{ id: "objective", subjects: ["rust"], status: "open", description: "Editable objective", indent: 0 }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    await fireEvent.click(screen.getByText("Editable objective"));
    const description = screen.getByPlaceholderText("Objective description");
    description.setSelectionRange(0, 8);
    await fireEvent.contextMenu(description);

    const cut = screen.getByRole("menuitem", { name: "Cut" });
    const copy = screen.getByRole("menuitem", { name: "Copy" });
    expect(cut.disabled).toBe(false);
    expect(copy.disabled).toBe(false);
    expect(screen.getByRole("menuitem", { name: "Paste" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Select All" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    expect(await fireEvent.pointerDown(copy)).toBe(false);
    expect(document.activeElement).toBe(description);
    expect(description.selectionStart).toBe(0);
    expect(description.selectionEnd).toBe(8);

    await fireEvent.keyDown(window, { key: "Escape" });
    description.setSelectionRange(3, 3);
    await fireEvent.contextMenu(description);
    expect(screen.getByRole("menuitem", { name: "Cut" }).disabled).toBe(true);
    expect(screen.getByRole("menuitem", { name: "Copy" }).disabled).toBe(true);
    await fireEvent.keyDown(window, { key: "Escape" });

    const subjectInput = screen.getByRole("textbox", { name: "Add subject" });
    await fireEvent.contextMenu(subjectInput);
    expect(screen.getByRole("menuitem", { name: "Paste" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Indent" })).toBeTruthy();
    readText.mockRejectedValueOnce(new Error("denied"));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Paste" }));
    await vi.waitFor(() => expect(appStore.statusMessage).toContain("Clipboard failed: Error: denied"));
  });

  it("selects all text in the active objective editor from its context menu", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    render(ObjectivesSection, {
      objectives: [{ id: "objective", subjects: [], status: "open", description: "Select this objective", indent: 0 }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    await fireEvent.click(screen.getByText("Select this objective"));
    const description = screen.getByPlaceholderText("Objective description");
    description.setSelectionRange(4, 4);
    await fireEvent.contextMenu(description);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Select All" }));

    expect(document.activeElement).toBe(description);
    expect(description.selectionStart).toBe(0);
    expect(description.selectionEnd).toBe(description.value.length);
    expect(screen.queryByRole("menu", { name: "Objective actions" })).toBeNull();
  });

  it("routes objective Cut and Paste through existing input updates", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    const onUpdate = vi.fn();
    render(ObjectivesSection, {
      objectives: [{ id: "objective", subjects: ["rust"], status: "open", description: "Editable objective", indent: 0 }],
      onAdd: vi.fn(), onUpdate, onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    await fireEvent.click(screen.getByText("Editable objective"));
    const description = screen.getByPlaceholderText("Objective description");
    description.setSelectionRange(0, 8);
    await fireEvent.contextMenu(description);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Cut" }));
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith("objective", { description: " objective" }));
    expect(writeText).toHaveBeenCalledWith("Editable");

    readText.mockResolvedValueOnce("Updated");
    description.setSelectionRange(0, 0);
    await fireEvent.contextMenu(description);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Paste" }));
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith("objective", { description: "Updated objective" }));
  });

  it("emits Weekly objective move actions", async () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    render(ObjectiveRow, {
      objective: { subjects: ["rust"], status: "open", description: "Move objective", indent: 0 },
      canMoveUp: true,
      canMoveDown: true,
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onMoveUp,
      onMoveDown
    });

    await fireEvent.click(screen.getByRole("button", { name: "Move objective up" }));
    await fireEvent.click(screen.getByRole("button", { name: "Move objective down" }));

    expect(onMoveUp).toHaveBeenCalledOnce();
    expect(onMoveDown).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Delete objective" })).toBeTruthy();
  });
});

describe("todo actions", () => {
  it("emits row deletion for the selected todo index", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: (text) => ({ width: text.length * 7 })
    });
    const { default: TodoRow } = await import("$lib/features/todo/components/TodoRow.svelte");
    render(TodoRow, {
      todo: { id: "todo-1", text: "Delete me", checked: false, indent: 0 },
      index: 2,
      inputElements: {},
      onToggleTodo: vi.fn(), onUpdateText: vi.fn(), onMoveTodoUp: vi.fn(), onMoveTodoDown: vi.fn(),
      onDeleteTodo: vi.fn(), onFocus: vi.fn(), onBlur: vi.fn(), onKeyDown: vi.fn()
    });
    expect(screen.queryByTitle("Delete")).toBeNull();
    expect(screen.getByPlaceholderText("New todo").getAttribute("spellcheck")).toBeNull();
  });

  it("deletes an empty todo with Backspace and focuses the previous todo", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: (text) => ({ width: text.length * 7 })
    });
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "Previous", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "", checked: false, indent: 0 }
    ];
    const deleteTodo = vi.spyOn(todoStore, "deleteTodo").mockImplementation((index) => todoStore.todos.splice(index, 1));
    try {
      render(TodoPanel);
      const emptyTodo = screen.getAllByPlaceholderText("New todo")[1];
      emptyTodo.focus();
      await fireEvent.keyDown(emptyTodo, { key: "Backspace" });

      expect(deleteTodo).toHaveBeenCalledWith(1);
      expect(document.activeElement).toBe(screen.getByDisplayValue("Previous"));
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("folds and unfolds nested todo descendants", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "Parent", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Child", checked: false, indent: 1 },
      { id: "todo-3", isTodo: true, text: "Peer", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      expect(screen.getByDisplayValue("Child")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Collapse todo" })).toBeTruthy();

      await fireEvent.click(screen.getByRole("button", { name: "Collapse todo" }));
      expect(screen.queryByDisplayValue("Child")).toBeNull();
      expect(screen.getByDisplayValue("Peer")).toBeTruthy();

      await fireEvent.click(screen.getByRole("button", { name: "Expand todo" }));
      expect(screen.getByDisplayValue("Child")).toBeTruthy();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("keeps nested folded state when an ancestor is expanded", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "Parent", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Child", checked: false, indent: 1 },
      { id: "todo-3", isTodo: true, text: "Grandchild", checked: false, indent: 2 },
      { id: "todo-4", isTodo: true, text: "Peer", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      const collapseButtons = screen.getAllByRole("button", { name: "Collapse todo" });
      await fireEvent.click(collapseButtons[1]);
      await fireEvent.click(collapseButtons[0]);
      expect(screen.queryByDisplayValue("Child")).toBeNull();

      await fireEvent.click(screen.getByRole("button", { name: "Expand todo" }));
      expect(screen.getByDisplayValue("Child")).toBeTruthy();
      expect(screen.queryByDisplayValue("Grandchild")).toBeNull();
      expect(screen.getByRole("button", { name: "Expand todo" })).toBeTruthy();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("uses real store indices for row actions after folding", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: (text) => ({ width: text.length * 7 })
    });
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "Parent", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Hidden child", checked: false, indent: 1 },
      { id: "todo-3", isTodo: true, text: "Visible peer", checked: false, indent: 0 }
    ];
    const deleteTodosByIds = vi.spyOn(todoStore, "deleteTodosByIds").mockImplementation(() => true);
    try {
      render(TodoPanel);
      await fireEvent.click(screen.getByRole("button", { name: "Collapse todo" }));
      await fireEvent.contextMenu(screen.getByDisplayValue("Visible peer"));
      await fireEvent.click(screen.getByRole("menuitem", { name: "Delete selected" }));
      expect(deleteTodosByIds).toHaveBeenCalledWith(["todo-3"]);
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("skips hidden descendants during keyboard navigation", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "Parent", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Hidden child", checked: false, indent: 1 },
      { id: "todo-3", isTodo: true, text: "Visible peer", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      await fireEvent.click(screen.getByRole("button", { name: "Collapse todo" }));
      const parent = screen.getByDisplayValue("Parent");
      parent.focus();
      await fireEvent.keyDown(parent, { key: "ArrowDown" });
      expect(document.activeElement).toBe(screen.getByDisplayValue("Visible peer"));
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("collapses and expands all foldable todos from the toolbar", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "Parent", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Child", checked: false, indent: 1 },
      { id: "todo-3", isTodo: true, text: "Peer", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      render(TodoToolbar, {
        undoStackLength: 0,
        redoStackLength: 0,
        onAddTodo: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onReload: vi.fn(),
        onClearCompleted: vi.fn()
      });

      await fireEvent.click(screen.getByRole("button", { name: "Collapse all todos" }));
      expect(screen.queryByDisplayValue("Child")).toBeNull();

      await fireEvent.click(screen.getByRole("button", { name: "Expand all todos" }));
      expect(screen.getByDisplayValue("Child")).toBeTruthy();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("toggles visible todo numbers from the toolbar and skips raw rows", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "raw-1", isTodo: false, raw: "# Notes" },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      render(TodoToolbar, {
        undoStackLength: 0,
        redoStackLength: 0,
        onAddTodo: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onReload: vi.fn(),
        onClearCompleted: vi.fn()
      });

      expect(screen.queryByRole("button", { name: "Move todo 1" })).toBeNull();
      await fireEvent.click(screen.getByRole("button", { name: "Show todo numbers" }));
      expect(screen.getByRole("button", { name: "Move todo 1" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Move todo 2" })).toBeTruthy();
      expect(screen.getByText("# Notes")).toBeTruthy();

      await fireEvent.click(screen.getByRole("button", { name: "Hide todo numbers" }));
      expect(screen.queryByRole("button", { name: "Move todo 1" })).toBeNull();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("moves a todo to a valid visible position from the row number input", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 },
      { id: "todo-3", isTodo: true, text: "Third", checked: false, indent: 0 }
    ];
    try {
      vi.spyOn(todoStore, "scheduleSave").mockResolvedValue(true);
      todoUiState.showTodoNumbers = true;
      render(TodoPanel);
      await fireEvent.click(screen.getByRole("button", { name: "Move todo 1" }));
      const target = screen.getByRole("textbox", { name: "Todo target position" });
      await fireEvent.input(target, { target: { value: "3" } });
      await fireEvent.keyDown(target, { key: "Enter" });

      expect(todoStore.todos.map((todo) => todo.text)).toEqual(["Second", "Third", "First"]);
      expect(document.activeElement).toBe(screen.getByDisplayValue("First"));
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("cancels invalid, out-of-range, same-position, blur, and Escape number edits", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 }
    ];
    try {
      vi.spyOn(todoStore, "scheduleSave").mockResolvedValue(true);
      todoUiState.showTodoNumbers = true;
      render(TodoPanel);

      await fireEvent.click(screen.getByRole("button", { name: "Move todo 1" }));
      let target = screen.getByRole("textbox", { name: "Todo target position" });
      await fireEvent.input(target, { target: { value: "9" } });
      await fireEvent.keyDown(target, { key: "Enter" });
      expect(todoStore.todos.map((todo) => todo.text)).toEqual(["First", "Second"]);

      await fireEvent.click(screen.getByRole("button", { name: "Move todo 1" }));
      target = screen.getByRole("textbox", { name: "Todo target position" });
      await fireEvent.input(target, { target: { value: "abc" } });
      await fireEvent.keyDown(target, { key: "Enter" });
      expect(todoStore.todos.map((todo) => todo.text)).toEqual(["First", "Second"]);

      await fireEvent.click(screen.getByRole("button", { name: "Move todo 1" }));
      target = screen.getByRole("textbox", { name: "Todo target position" });
      await fireEvent.keyDown(target, { key: "Escape" });
      expect(screen.queryByRole("textbox", { name: "Todo target position" })).toBeNull();

      await fireEvent.click(screen.getByRole("button", { name: "Move todo 1" }));
      target = screen.getByRole("textbox", { name: "Todo target position" });
      await fireEvent.blur(target);
      expect(screen.queryByRole("textbox", { name: "Todo target position" })).toBeNull();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("maps visible number movement through folded rows and moves only the selected row", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "Parent", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Child", checked: false, indent: 1 },
      { id: "todo-3", isTodo: true, text: "Peer", checked: false, indent: 0 }
    ];
    try {
      vi.spyOn(todoStore, "scheduleSave").mockResolvedValue(true);
      todoUiState.showTodoNumbers = true;
      render(TodoPanel);
      await fireEvent.click(screen.getByRole("button", { name: "Collapse todo" }));
      expect(screen.queryByDisplayValue("Child")).toBeNull();

      await fireEvent.click(screen.getByRole("button", { name: "Move todo 1" }));
      const target = screen.getByRole("textbox", { name: "Todo target position" });
      await fireEvent.input(target, { target: { value: "2" } });
      await fireEvent.keyDown(target, { key: "Enter" });

      expect(todoStore.todos.map((todo) => todo.text)).toEqual(["Child", "Peer", "Parent"]);
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("moves the focused todo by visible position with Alt+Arrow", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 },
      { id: "todo-3", isTodo: true, text: "Third", checked: false, indent: 0 }
    ];
    try {
      vi.spyOn(todoStore, "scheduleSave").mockResolvedValue(true);
      render(TodoPanel);
      const second = screen.getByDisplayValue("Second");
      second.focus();
      await fireEvent.keyDown(second, { key: "ArrowUp", altKey: true });
      expect(todoStore.todos.map((todo) => todo.text)).toEqual(["Second", "First", "Third"]);
      expect(document.activeElement).toBe(screen.getByDisplayValue("Second"));

      await fireEvent.keyDown(screen.getByDisplayValue("Second"), { key: "ArrowDown", altKey: true });
      expect(todoStore.todos.map((todo) => todo.text)).toEqual(["First", "Second", "Third"]);
      expect(document.activeElement).toBe(screen.getByDisplayValue("Second"));
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("selects and toggles visible todos with Ctrl+click", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First"), { ctrlKey: true });
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1"]);
      expect(screen.getByDisplayValue("First").closest(".todo-row").classList.contains("selected")).toBe(true);

      await fireEvent.pointerDown(screen.getByDisplayValue("First"), { ctrlKey: true });
      expect(todoUiState.selectedTodoIds).toEqual([]);
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("selects a visible range with Shift+click and skips raw and folded rows", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "Parent", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Hidden child", checked: false, indent: 1 },
      { id: "raw-1", isTodo: false, raw: "# Notes" },
      { id: "todo-3", isTodo: true, text: "Peer", checked: false, indent: 0 },
      { id: "todo-4", isTodo: true, text: "Last", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      await fireEvent.click(screen.getByRole("button", { name: "Collapse todo" }));
      await fireEvent.pointerDown(screen.getByDisplayValue("Parent"), { ctrlKey: true });
      await fireEvent.pointerDown(screen.getByDisplayValue("Last"), { shiftKey: true });
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1", "todo-3", "todo-4"]);
      expect(todoUiState.selectedTodoIds).not.toContain("todo-2");
      expect(todoUiState.selectedTodoIds).not.toContain("raw-1");
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("selects only the clicked row on Shift+click without an anchor", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("Second"), { shiftKey: true });
      expect(todoUiState.selectedTodoIds).toEqual(["todo-2"]);
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("uses a normal clicked todo as the Shift+click range anchor", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 },
      { id: "todo-3", isTodo: true, text: "Third", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First"));
      await fireEvent.pointerDown(screen.getByDisplayValue("Third"), { shiftKey: true });
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1", "todo-2", "todo-3"]);
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("makes inputs readonly while selection exists and clears on plain row click", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First"), { ctrlKey: true });
      expect(screen.getByDisplayValue("First").readOnly).toBe(true);

      await fireEvent.pointerDown(screen.getByDisplayValue("Second"));
      expect(todoUiState.selectedTodoIds).toEqual([]);
      expect(screen.getByDisplayValue("Second").readOnly).toBe(false);
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("clears selection with Escape, blank list clicks, row fold, and fold all", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "Parent", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Child", checked: false, indent: 1 },
      { id: "todo-3", isTodo: true, text: "Peer", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("Parent"), { ctrlKey: true });
      await fireEvent.keyDown(screen.getByDisplayValue("Parent"), { key: "Escape" });
      expect(todoUiState.selectedTodoIds).toEqual([]);

      await fireEvent.pointerDown(screen.getByDisplayValue("Parent"), { ctrlKey: true });
      await fireEvent.click(screen.getByRole("button", { name: "Collapse todo" }));
      expect(todoUiState.selectedTodoIds).toEqual([]);

      await fireEvent.pointerDown(screen.getByDisplayValue("Peer"), { ctrlKey: true });
      await fireEvent.pointerDown(screen.getByDisplayValue("Peer").closest(".todo-list"));
      expect(todoUiState.selectedTodoIds).toEqual([]);

      await fireEvent.pointerDown(screen.getByDisplayValue("Peer"), { ctrlKey: true });
      render(TodoToolbar, {
        undoStackLength: 0,
        redoStackLength: 0,
        onAddTodo: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onReload: vi.fn(),
        onClearCompleted: vi.fn()
      });
      await fireEvent.click(screen.getByRole("button", { name: /all todos/ }));
      expect(todoUiState.selectedTodoIds).toEqual([]);
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("keeps normal checkbox and row number behavior when no selection is active", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 }
    ];
    try {
      vi.spyOn(todoStore, "scheduleSave").mockResolvedValue(true);
      todoUiState.showTodoNumbers = true;
      render(TodoPanel);
      await fireEvent.click(screen.getAllByTitle("Mark completed")[0]);
      expect(todoStore.todos[0].checked).toBe(true);

      await fireEvent.click(screen.getByRole("button", { name: "Move todo 1" }));
      expect(screen.getByRole("textbox", { name: "Todo target position" })).toBeTruthy();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("opens the todo context menu for selected rows and keeps selection", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First"), { ctrlKey: true });
      await fireEvent.pointerDown(screen.getByDisplayValue("Second"), { ctrlKey: true });
      await fireEvent.pointerDown(screen.getByDisplayValue("First"), { button: 2 });
      await fireEvent.contextMenu(screen.getByDisplayValue("First"), { clientX: 10, clientY: 12 });

      expect(todoUiState.selectedTodoIds).toEqual(["todo-1", "todo-2"]);
      const menu = screen.getByRole("menu", { name: "Todo selection actions" });
      const nativeMenuEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      expect(menu).toBeTruthy();
      expect(menu.dispatchEvent(nativeMenuEvent)).toBe(false);
      expect(screen.getByText("2 selected")).toBeTruthy();
      expect(screen.queryByRole("menuitem", { name: "Copy" })).toBeNull();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("adds clipboard actions to editable todos while retaining Todo actions", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [{ id: "todo-1", isTodo: true, text: "First todo", checked: false, indent: 0 }];
    try {
      vi.spyOn(todoStore, "scheduleSave").mockResolvedValue(true);
      render(TodoPanel);
      let textarea = screen.getByDisplayValue("First todo");
      textarea.focus();
      textarea.setSelectionRange(0, 5);
      await fireEvent.contextMenu(textarea, { clientX: 10, clientY: 12 });

      expect(screen.getByRole("menuitem", { name: "Cut" }).disabled).toBe(false);
      expect(screen.getByRole("menuitem", { name: "Copy" }).disabled).toBe(false);
      expect(screen.getByRole("menuitem", { name: "Paste" })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "Select All" })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "Delete selected" })).toBeTruthy();
      await fireEvent.click(screen.getByRole("menuitem", { name: "Cut" }));

      await vi.waitFor(() => expect(todoStore.todos[0].text).toBe(" todo"));
      expect(writeText).toHaveBeenCalledWith("First");
      expect(todoUiState.selectedTodoIds).toEqual([]);

      readText.mockResolvedValueOnce("Updated");
      expect(textarea.value).toBe(" todo");
      textarea.setSelectionRange(0, 1);
      await fireEvent.contextMenu(textarea, { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: "Paste" }));

      await vi.waitFor(() => expect(todoStore.todos[0].text).toBe("Updatedtodo"));
      expect(todoUiState.selectedTodoIds).toEqual([]);
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("right-clicking an unselected todo replaces selection before opening the context menu", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("Second"), { clientX: 10, clientY: 12 });

      expect(todoUiState.selectedTodoIds).toEqual(["todo-2"]);
      expect(screen.getByText("1 selected")).toBeTruthy();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("right-clicking raw or blank todo space clears selection without opening the context menu", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "raw-1", isTodo: false, raw: "# Notes" }
    ];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByText("# Notes"));
      expect(todoUiState.selectedTodoIds).toEqual([]);
      expect(screen.queryByRole("menu", { name: "Todo selection actions" })).toBeNull();

      await fireEvent.pointerDown(screen.getByDisplayValue("First"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First"), { clientX: 10, clientY: 12 });
      expect(screen.getByRole("menu", { name: "Todo selection actions" })).toBeTruthy();
      await fireEvent.contextMenu(screen.getByDisplayValue("First").closest(".todo-list"));
      expect(todoUiState.selectedTodoIds).toEqual([]);
      expect(screen.queryByRole("menu", { name: "Todo selection actions" })).toBeNull();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("deletes selected todos from the context menu and clears selection", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 },
      { id: "todo-3", isTodo: true, text: "Third", checked: false, indent: 0 }
    ];
    const deleteTodosByIds = vi.spyOn(todoStore, "deleteTodosByIds");
    try {
      vi.spyOn(todoStore, "scheduleSave").mockResolvedValue(true);
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First"), { ctrlKey: true });
      await fireEvent.pointerDown(screen.getByDisplayValue("Second"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First"), { clientX: 10, clientY: 12 });
      const deleteItem = screen.getByRole("menuitem", { name: /Delete selected/ });
      await fireEvent.pointerDown(deleteItem);
      expect(screen.getByRole("menu", { name: "Todo selection actions" })).toBeTruthy();
      await fireEvent.click(deleteItem);

      expect(deleteTodosByIds).toHaveBeenCalledWith(["todo-1", "todo-2"]);
      expect(todoStore.todos.map((todo) => todo.id)).toEqual(["todo-3"]);
      expect(todoUiState.selectedTodoIds).toEqual([]);
      expect(screen.queryByRole("menu", { name: "Todo selection actions" })).toBeNull();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("checks and unchecks selected todos from the context menu without clearing selection", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: true, indent: 0 },
      { id: "todo-3", isTodo: true, text: "Third", checked: false, indent: 0 }
    ];
    try {
      vi.spyOn(todoStore, "scheduleSave").mockResolvedValue(true);
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First"), { ctrlKey: true });
      await fireEvent.pointerDown(screen.getByDisplayValue("Second"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First"), { clientX: 10, clientY: 12 });

      expect(screen.getByRole("menuitem", { name: /Check selected/ })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: /Uncheck selected/ })).toBeTruthy();

      await fireEvent.click(screen.getByRole("menuitem", { name: /Check selected/ }));
      expect(todoStore.todos.map((todo) => todo.checked)).toEqual([true, true, false]);
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1", "todo-2"]);
      expect(screen.queryByRole("menu", { name: "Todo selection actions" })).toBeNull();

      await fireEvent.contextMenu(screen.getByDisplayValue("First"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Uncheck selected/ }));
      expect(todoStore.todos.map((todo) => todo.checked)).toEqual([false, false, false]);
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1", "todo-2"]);
      expect(screen.queryByRole("menu", { name: "Todo selection actions" })).toBeNull();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("indents and outdents selected todos from the context menu without clearing selection", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 1 },
      { id: "todo-3", isTodo: true, text: "Third", checked: false, indent: 0 }
    ];
    try {
      vi.spyOn(todoStore, "scheduleSave").mockResolvedValue(true);
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First"), { ctrlKey: true });
      await fireEvent.pointerDown(screen.getByDisplayValue("Second"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First"), { clientX: 10, clientY: 12 });

      expect(screen.getByRole("menuitem", { name: /Indent selected/ })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: /Outdent selected/ })).toBeTruthy();

      await fireEvent.click(screen.getByRole("menuitem", { name: /Indent selected/ }));
      expect(todoStore.todos.map((todo) => todo.indent)).toEqual([1, 2, 0]);
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1", "todo-2"]);
      expect(screen.queryByRole("menu", { name: "Todo selection actions" })).toBeNull();

      await fireEvent.contextMenu(screen.getByDisplayValue("First"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Outdent selected/ }));
      expect(todoStore.todos.map((todo) => todo.indent)).toEqual([0, 1, 0]);
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1", "todo-2"]);
      expect(screen.queryByRole("menu", { name: "Todo selection actions" })).toBeNull();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("sends selected todos to weekly objectives and clears selection", async () => {
    const originalTodos = todoStore.todos;
    const originalWeeks = workspaceStore.weeks;
    const descriptor = getWeekDescriptor(new Date());
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First objective", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second objective", checked: false, indent: 0 }
    ];
    workspaceStore.weeks = [{ name: descriptor.folderName, indexPath: "week.md", days: [] }];
    const loadPath = vi.spyOn(weekStore, "loadPath").mockResolvedValue(true);
    const addObjectives = vi.spyOn(weekStore, "addObjectives").mockReturnValue(true);
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First objective"), { ctrlKey: true });
      await fireEvent.pointerDown(screen.getByDisplayValue("Second objective"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First objective"), { clientX: 10, clientY: 12 });

      expect(screen.getByRole("menuitem", { name: /Send to today's activity/ })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: /Send to weekly objective/ })).toBeTruthy();

      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to weekly objective/ }));
      expect(loadPath).toHaveBeenCalledWith("week.md", descriptor, []);
      expect(addObjectives).toHaveBeenCalledWith(["First objective", "Second objective"]);
      expect(todoUiState.selectedTodoIds).toEqual([]);
    } finally {
      todoStore.todos = originalTodos;
      workspaceStore.weeks = originalWeeks;
    }
  });

  it("keeps selection when weekly objective send has no current week", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [{ id: "todo-1", isTodo: true, text: "First objective", checked: false, indent: 0 }];
    workspaceStore.weeks = [];
    const showStatus = vi.spyOn(appStore, "showStatus");
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First objective"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First objective"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to weekly objective/ }));
      expect(showStatus).toHaveBeenCalledWith("Current week not found");
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1"]);
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("opens a today session picker and sends selected todos as activities", async () => {
    const originalTodos = todoStore.todos;
    const originalWeeks = workspaceStore.weeks;
    const descriptor = getWeekDescriptor(new Date());
    const today = formatDate(new Date());
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First activity", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second activity", checked: false, indent: 0 }
    ];
    workspaceStore.weeks = [{ name: descriptor.folderName, indexPath: "week.md", days: [{ path: "today.md", date: today }] }];
    dailyStore.path = "";
    dailyStore.sessions = [{ id: "session-1", name: "Work", activities: [] }];
    const loadPath = vi.spyOn(dailyStore, "loadPath").mockResolvedValue(true);
    const addActivities = vi.spyOn(dailyStore, "addActivities").mockReturnValue(true);
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First activity"), { ctrlKey: true });
      await fireEvent.pointerDown(screen.getByDisplayValue("Second activity"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First activity"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to today's activity/ }));

      expect(loadPath).toHaveBeenCalledWith("today.md", today);
      expect(screen.getByRole("menu", { name: "Choose activity session" })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: /Work/ }).getAttribute("title")).toBe("Work");

      await fireEvent.click(screen.getByRole("menuitem", { name: /Work/ }));
      expect(addActivities).toHaveBeenCalledWith("session-1", ["First activity", "Second activity"]);
      expect(appStore.currentView).toBe("todo");
      expect(todoUiState.selectedTodoIds).toEqual([]);
      expect(screen.queryByRole("menu", { name: "Choose activity session" })).toBeNull();
    } finally {
      todoStore.todos = originalTodos;
      workspaceStore.weeks = originalWeeks;
    }
  });

  it("opens a weekly planned picker and sends selected todos as planned activities", async () => {
    const originalTodos = todoStore.todos;
    const originalWeeks = workspaceStore.weeks;
    const descriptor = getWeekDescriptor(new Date());
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First planned activity", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second planned activity", checked: false, indent: 0 }
    ];
    workspaceStore.weeks = [{ name: descriptor.folderName, indexPath: "week.md", days: [] }];
    weekStore.path = "";
    weekStore.plan = [
      { id: "p1", day: "Mon", session: "Long planned session name that should be visible on hover", activities: [] },
      { id: "p2", day: "Fri", session: "Friday session", activities: [] }
    ];
    const loadPath = vi.spyOn(weekStore, "loadPath").mockResolvedValue(true);
    const addPlanActivities = vi.spyOn(weekStore, "addPlanActivities").mockReturnValue(true);
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First planned activity"), { ctrlKey: true });
      await fireEvent.pointerDown(screen.getByDisplayValue("Second planned activity"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First planned activity"), { clientX: 10, clientY: 12 });

      expect(screen.getByRole("menuitem", { name: /Send to weekly planned/ })).toBeTruthy();
      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to weekly planned/ }));

      expect(loadPath).toHaveBeenCalledWith("week.md", descriptor, []);
      expect(screen.getByRole("menu", { name: "Choose weekly planned session" })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: /Long planned session name/ }).getAttribute("title")).toBe("Long planned session name that should be visible on hover");

      await fireEvent.click(screen.getByRole("menuitem", { name: /Long planned session name/ }));
      expect(addPlanActivities).toHaveBeenCalledWith("p1", ["First planned activity", "Second planned activity"]);
      expect(todoUiState.selectedTodoIds).toEqual([]);
      expect(screen.queryByRole("menu", { name: "Choose weekly planned session" })).toBeNull();
    } finally {
      todoStore.todos = originalTodos;
      workspaceStore.weeks = originalWeeks;
    }
  });

  it("warns for an empty weekly planned day and keeps selection", async () => {
    const originalTodos = todoStore.todos;
    const originalWeeks = workspaceStore.weeks;
    const descriptor = getWeekDescriptor(new Date());
    const showStatus = vi.spyOn(appStore, "showStatus");
    todoStore.todos = [{ id: "todo-1", isTodo: true, text: "First planned activity", checked: false, indent: 0 }];
    workspaceStore.weeks = [{ name: descriptor.folderName, indexPath: "week.md", days: [] }];
    weekStore.path = "week.md";
    weekStore.plan = [{ id: "p1", day: "Mon", session: "Monday session", activities: [] }];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First planned activity"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First planned activity"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to weekly planned/ }));
      await fireEvent.click(screen.getByRole("button", { name: "Tue" }));

      expect(showStatus).toHaveBeenCalledWith("No planned sessions for Tue");
      expect(screen.getByText("No planned sessions")).toBeTruthy();
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1"]);
    } finally {
      todoStore.todos = originalTodos;
      workspaceStore.weeks = originalWeeks;
    }
  });

  it("keeps selection when weekly planned send has no current week or plan entries", async () => {
    const originalTodos = todoStore.todos;
    const showStatus = vi.spyOn(appStore, "showStatus");
    todoStore.todos = [{ id: "todo-1", isTodo: true, text: "First planned activity", checked: false, indent: 0 }];
    workspaceStore.weeks = [];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First planned activity"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First planned activity"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to weekly planned/ }));
      expect(showStatus).toHaveBeenCalledWith("Current week not found");
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1"]);

      const descriptor = getWeekDescriptor(new Date());
      workspaceStore.weeks = [{ name: descriptor.folderName, indexPath: "week.md", days: [] }];
      weekStore.path = "week.md";
      weekStore.plan = [];
      await fireEvent.contextMenu(screen.getByDisplayValue("First planned activity"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to weekly planned/ }));
      expect(showStatus).toHaveBeenCalledWith("No weekly planned sessions");
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1"]);
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("closes the weekly planned picker with outside click and Escape", async () => {
    const originalTodos = todoStore.todos;
    const originalWeeks = workspaceStore.weeks;
    const descriptor = getWeekDescriptor(new Date());
    todoStore.todos = [{ id: "todo-1", isTodo: true, text: "First planned activity", checked: false, indent: 0 }];
    workspaceStore.weeks = [{ name: descriptor.folderName, indexPath: "week.md", days: [] }];
    weekStore.path = "week.md";
    weekStore.plan = [{ id: "p1", day: "Mon", session: "Monday session", activities: [] }];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First planned activity"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First planned activity"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to weekly planned/ }));
      expect(screen.getByRole("menu", { name: "Choose weekly planned session" })).toBeTruthy();
      await fireEvent.pointerDown(document.body);
      expect(screen.queryByRole("menu", { name: "Choose weekly planned session" })).toBeNull();

      await fireEvent.contextMenu(screen.getByDisplayValue("First planned activity"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to weekly planned/ }));
      await fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("menu", { name: "Choose weekly planned session" })).toBeNull();
    } finally {
      todoStore.todos = originalTodos;
      workspaceStore.weeks = originalWeeks;
    }
  });

  it("refreshes the workspace tree before reporting today's log missing", async () => {
    const originalTodos = todoStore.todos;
    const originalWeeks = workspaceStore.weeks;
    const descriptor = getWeekDescriptor(new Date());
    const today = formatDate(new Date());
    todoStore.todos = [{ id: "todo-1", isTodo: true, text: "First activity", checked: false, indent: 0 }];
    workspaceStore.weeks = [];
    dailyStore.path = "";
    dailyStore.sessions = [{ id: "session-1", name: "Work", activities: [] }];
    const refresh = vi.spyOn(workspaceStore, "refresh").mockImplementation(async () => {
      workspaceStore.weeks = [{ name: descriptor.folderName, indexPath: "week.md", days: [{ path: "today.md", date: today }] }];
      return true;
    });
    const loadPath = vi.spyOn(dailyStore, "loadPath").mockResolvedValue(true);
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First activity"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First activity"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to today's activity/ }));

      expect(refresh).toHaveBeenCalledOnce();
      expect(loadPath).toHaveBeenCalledWith("today.md", today);
      expect(screen.getByRole("menu", { name: "Choose activity session" })).toBeTruthy();
    } finally {
      todoStore.todos = originalTodos;
      workspaceStore.weeks = originalWeeks;
    }
  });

  it("keeps selection when today activity send cannot find a log or session", async () => {
    const originalTodos = todoStore.todos;
    const showStatus = vi.spyOn(appStore, "showStatus");
    todoStore.todos = [{ id: "todo-1", isTodo: true, text: "First activity", checked: false, indent: 0 }];
    workspaceStore.weeks = [];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First activity"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First activity"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to today's activity/ }));
      expect(showStatus).toHaveBeenCalledWith("Today log not found");
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1"]);
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("closes the today session picker with outside click and Escape", async () => {
    const originalTodos = todoStore.todos;
    const originalWeeks = workspaceStore.weeks;
    const descriptor = getWeekDescriptor(new Date());
    const today = formatDate(new Date());
    todoStore.todos = [{ id: "todo-1", isTodo: true, text: "First activity", checked: false, indent: 0 }];
    workspaceStore.weeks = [{ name: descriptor.folderName, indexPath: "week.md", days: [{ path: "today.md", date: today }] }];
    dailyStore.path = "today.md";
    dailyStore.sessions = [{ id: "session-1", name: "A very long session name that should clamp", activities: [] }];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First activity"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First activity"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to today's activity/ }));
      expect(screen.getByRole("menu", { name: "Choose activity session" })).toBeTruthy();
      await fireEvent.pointerDown(document.body);
      expect(screen.queryByRole("menu", { name: "Choose activity session" })).toBeNull();

      await fireEvent.contextMenu(screen.getByDisplayValue("First activity"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Send to today's activity/ }));
      await fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("menu", { name: "Choose activity session" })).toBeNull();
    } finally {
      todoStore.todos = originalTodos;
      workspaceStore.weeks = originalWeeks;
    }
  });

  it("clears selection from the context menu and closes it on outside click or Escape", async () => {
    const originalTodos = todoStore.todos;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "First", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Second", checked: false, indent: 0 }
    ];
    try {
      render(TodoPanel);
      await fireEvent.pointerDown(screen.getByDisplayValue("First"), { ctrlKey: true });
      await fireEvent.contextMenu(screen.getByDisplayValue("First"), { clientX: 10, clientY: 12 });
      await fireEvent.pointerDown(document.body);
      expect(screen.queryByRole("menu", { name: "Todo selection actions" })).toBeNull();
      expect(todoUiState.selectedTodoIds).toEqual(["todo-1"]);

      await fireEvent.contextMenu(screen.getByDisplayValue("First"), { clientX: 10, clientY: 12 });
      await fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("menu", { name: "Todo selection actions" })).toBeNull();

      await fireEvent.contextMenu(screen.getByDisplayValue("First"), { clientX: 10, clientY: 12 });
      await fireEvent.click(screen.getByRole("menuitem", { name: /Clear selection/ }));
      expect(todoUiState.selectedTodoIds).toEqual([]);
      expect(screen.queryByRole("menu", { name: "Todo selection actions" })).toBeNull();
    } finally {
      todoStore.todos = originalTodos;
    }
  });

  it("renders selected count through the header status text", () => {
    render(AppHeader, {
      dragEnabled: true,
      layerMode: "normal",
      statusMessage: "2 selected",
      title: "Todo",
      showModeMenu: false,
      onToggleSidebar: vi.fn(),
      onToggleModeMenu: vi.fn(),
      onSelectMode: vi.fn(),
      onToggleSettings: vi.fn(),
      onShrinkApp: vi.fn(),
      onMaximizeApp: vi.fn(),
      onCloseApp: vi.fn()
    });

    expect(screen.getByText("Todo - 2 selected")).toBeTruthy();
  });

});

describe("unavailable logs folder", () => {
  it("offers locate, select, and retry actions", async () => {
    workspaceStore.unavailable = true;
    const chooseRoot = vi.spyOn(workspaceStore, "chooseRoot").mockResolvedValue(true);
    const refresh = vi.spyOn(workspaceStore, "refresh").mockResolvedValue(true);
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn(), onClose: vi.fn() });
    const recovery = screen.getByText("Workspace unavailable").parentElement;
    await fireEvent.click(within(recovery).getByRole("button", { name: "Locate existing" }));
    await fireEvent.click(within(recovery).getByRole("button", { name: "Select new" }));
    await fireEvent.click(within(recovery).getByRole("button", { name: "Retry" }));
    expect(chooseRoot).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe("sidebar sorting", () => {
  it("opens the Week Files menu and runs the current-week shortcut", async () => {
    const createCurrentWeekFiles = vi.spyOn(workspaceStore, "createCurrentWeekFiles").mockResolvedValue(true);
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });

    expect(screen.queryByRole("button", { name: "Select workspace folder" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Initialize current week/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Fill in missing files/ })).toBeNull();

    await fireEvent.click(screen.getByRole("button", { name: "Week files" }));
    expect(screen.getByRole("menu", { name: "Week files" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("menuitem", { name: "Current week — check/repair" }));

    expect(createCurrentWeekFiles).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu", { name: "Week files" })).toBeNull();
  });

  it("runs the next-week shortcut from the Week Files menu", async () => {
    const createNextWeekFiles = vi.spyOn(workspaceStore, "createNextWeekFiles").mockResolvedValue(true);
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });

    await fireEvent.click(screen.getByRole("button", { name: "Week files" }));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Next week — create" }));

    expect(createNextWeekFiles).toHaveBeenCalledOnce();
  });

  it("chooses and previews a consecutive ISO week range with app-styled controls", async () => {
    const createSelectedWeekFiles = vi.spyOn(workspaceStore, "createSelectedWeekFiles").mockResolvedValue(true);
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });

    await fireEvent.click(screen.getByRole("button", { name: "Week files" }));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Choose weeks…" }));

    expect(screen.getByRole("dialog", { name: "Choose weeks" })).toBeTruthy();
    const current = getWeekDescriptor(new Date());
    const nextDate = new Date(current.start);
    nextDate.setDate(nextDate.getDate() + 7);
    const next = getWeekDescriptor(nextDate);
    const followingDate = new Date(next.start);
    followingDate.setDate(followingDate.getDate() + 7);
    const following = getWeekDescriptor(followingDate);

    expect(screen.queryByRole("spinbutton")).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Next start week" }));
    await fireEvent.click(screen.getByRole("button", { name: "Increase number of weeks" }));

    expect(screen.getByLabelText(`${next.folderName} · ${next.rangeLabel}`)).toBeTruthy();
    expect(screen.getByLabelText(`${following.folderName} · ${following.rangeLabel}`)).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Check/repair 2 weeks" }));

    expect(createSelectedWeekFiles).toHaveBeenCalledWith(next.year, next.week, 2);
    expect(screen.queryByRole("dialog", { name: "Choose weeks" })).toBeNull();
  });

  it("opens a readable week calendar and selects a whole week", async () => {
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });
    await fireEvent.click(screen.getByRole("button", { name: "Week files" }));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Choose weeks…" }));

    const selected = getWeekDescriptor(new Date());
    await fireEvent.click(screen.getByRole("button", { name: /Choose start week/ }));

    expect(screen.getByRole("group", { name: "Choose start week" })).toBeTruthy();
    expect(screen.getByRole("button", {
      name: `Select Week ${selected.week}, ${selected.year}: ${selected.rangeLabel}`
    })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next month" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "This week" })).toBeTruthy();
  });

  it("dismisses the Week Files menu with Escape", async () => {
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });
    await fireEvent.click(screen.getByRole("button", { name: "Week files" }));
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Week files" })).toBeNull();
  });

  it("toggles between newest-first and oldest-first", async () => {
    workspaceStore.weeks = [
      { path: "new", name: "2026w25", indexPath: null, days: [] },
      { path: "old", name: "2025w52", indexPath: null, days: [] }
    ];
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });
    const labels = () => screen.getAllByRole("button", { name: /20\d\dw\d\d/ }).map((button) => button.textContent.trim());
    expect(labels()).toEqual(["2026w25", "2025w52"]);
    const sortButton = screen.getByRole("button", { name: "Week order: newest first — click for oldest first" });
    expect(sortButton.title).toBe("Week order: newest first — click for oldest first");
    await fireEvent.click(sortButton);
    expect(screen.getByRole("button", { name: "Week order: oldest first — click for newest first" }).title)
      .toBe("Week order: oldest first — click for newest first");
    expect(labels()).toEqual(["2025w52", "2026w25"]);
  });

  it("retains sorting and expansion state while hidden", async () => {
    const props = { open: true, selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() };
    workspaceStore.weeks = [
      { path: "new", name: "2026w25", indexPath: null, days: [] },
      { path: "old", name: "2025w52", indexPath: null, days: [] }
    ];
    const view = render(AppSidebar, props);
    const labels = () => screen.getAllByRole("button", { name: /20\d\dw\d\d/ }).map((button) => button.textContent.trim());
    await fireEvent.click(screen.getByRole("button", { name: /Week order:/ }));
    await fireEvent.click(screen.getByRole("button", { name: "2025w52" }));
    expect(labels()).toEqual(["2025w52", "2026w25"]);
    expect(screen.getByRole("button", { name: "2025w52" }).getAttribute("aria-expanded")).toBe("false");

    await view.rerender({ ...props, open: false });
    await view.rerender({ ...props, open: true });

    expect(labels()).toEqual(["2025w52", "2026w25"]);
    expect(screen.getByRole("button", { name: "2025w52" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("collapses and expands all week folders without disabling per-week toggles", async () => {
    workspaceStore.weeks = [
      { path: "week", name: "2026w25", indexPath: "week/index.md", days: [{ path: "week/day.md", date: "2026-06-22" }] }
    ];
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });

    expect(screen.getByText("Weekly index")).toBeTruthy();
    expect(screen.getByText("2026-06-22")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Collapse all weeks" }));
    expect(screen.queryByText("Weekly index")).toBeNull();
    expect(screen.queryByText("2026-06-22")).toBeNull();
    expect(screen.getByRole("button", { name: "2026w25" }).getAttribute("aria-expanded")).toBe("false");

    await fireEvent.click(screen.getByRole("button", { name: "Expand all weeks" }));
    expect(screen.getByText("Weekly index")).toBeTruthy();
    expect(screen.getByText("2026-06-22")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "2026w25" }));
    expect(screen.queryByText("Weekly index")).toBeNull();
    expect(screen.getByRole("button", { name: "2026w25" }).getAttribute("aria-expanded")).toBe("false");
  });

});

describe("workspace settings and todo recovery", () => {
  it("shows one workspace setting with derived todo status", () => {
    appStore.logsRootPath = "C:\\Tracker";
    appStore.filePath = "C:\\Tracker\\todo.md";
    workspaceStore.todoExists = false;
    render(SettingsPanel, { dragEnabled: true, autostartEnabled: false, onToggleDrag: vi.fn(), onToggleAutostart: vi.fn() });

    expect(screen.getByText("Workspace folder")).toBeTruthy();
    expect(screen.queryByText("Todo document")).toBeNull();
    expect(screen.getByTitle("C:\\Tracker")).toBeTruthy();
    expect(screen.getByTitle("C:\\Tracker\\todo.md")).toBeTruthy();
    expect(screen.getByText("Missing")).toBeTruthy();
  });

  it("rebuilds subject history from settings", async () => {
    appStore.logsRootPath = "C:\\Tracker";
    subjectHistoryStore.history = { subjects: { rust: { count: 1, last_used: "now" } } };
    const rebuild = vi.spyOn(subjectHistoryStore, "rebuild").mockResolvedValue(true);
    render(SettingsPanel, { dragEnabled: true, autostartEnabled: false, onToggleDrag: vi.fn(), onToggleAutostart: vi.fn() });

    expect(screen.getByText("Subject history")).toBeTruthy();
    expect(screen.getByText("1 subject")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Rebuild subject history/ }));

    expect(rebuild).toHaveBeenCalledWith("C:\\Tracker");
  });

  it("rebuilds session history from settings", async () => {
    appStore.logsRootPath = "C:\\Tracker";
    sessionHistoryStore.history = { sessions: { Work: { planned_count: 1, actual_count: 2, last_used: "now" } } };
    const rebuild = vi.spyOn(sessionHistoryStore, "rebuild").mockResolvedValue(true);
    render(SettingsPanel, { dragEnabled: true, autostartEnabled: false, onToggleDrag: vi.fn(), onToggleAutostart: vi.fn() });

    expect(screen.getByText("Session history")).toBeTruthy();
    expect(screen.getByText("1 session")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Rebuild session history/ }));

    expect(rebuild).toHaveBeenCalledWith("C:\\Tracker");
  });

  it("changes frontmatter mode from settings", async () => {
    appStore.frontmatterMode = "off";
    const changeFrontmatterMode = vi.spyOn(appStore, "changeFrontmatterMode").mockResolvedValue(undefined);
    render(SettingsPanel, { dragEnabled: true, autostartEnabled: false, onToggleDrag: vi.fn(), onToggleAutostart: vi.fn() });

    await fireEvent.click(screen.getByRole("button", { name: "Personal" }));

    expect(screen.getByText("Frontmatter")).toBeTruthy();
    expect(changeFrontmatterMode).toHaveBeenCalledWith("personal");
  });

  it("offers create and import when workspace todo is missing", () => {
    appStore.logsRootPath = "C:\\Tracker";
    appStore.filePath = "C:\\Tracker\\todo.md";
    workspaceStore.unavailable = false;
    workspaceStore.todoExists = false;
    todoStore.fileMissing = true;
    render(TodoPanel);

    expect(screen.getByText("No todo.md found")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create todo.md" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import Markdown" })).toBeTruthy();
  });

  it("passes frontmatter mode when creating week files", async () => {
    appStore.logsRootPath = "C:\\Tracker";
    appStore.frontmatterMode = "personal";
    const createWeek = vi.spyOn(logWorkspaceService, "createWeek").mockResolvedValue([]);
    vi.spyOn(workspaceStore, "refresh").mockResolvedValue(true);

    await workspaceStore.createCurrentWeekFiles();

    expect(createWeek).toHaveBeenCalledWith("C:\\Tracker", expect.any(Date), "personal");
  });
});

describe("NotesEditor interactions", () => {
  async function renderNotes(props) {
    const { default: NotesEditor } = await import("$lib/shared/components/NotesEditor.svelte");
    const result = render(NotesEditor, props);
    await tick();
    const textbox = screen.getByRole("textbox", { name: props.label ?? "Notes" });
    const view = EditorView.findFromDOM(textbox);
    if (!view) throw new Error("CodeMirror editor was not mounted");
    return { ...result, textbox, view };
  }

  it("styles all heading levels inside one continuous editor", async () => {
    const { container } = await renderNotes({
      value: "# One\n## Two\n### Three\n#### Four\n##### Five\n###### Six",
      onChange: vi.fn()
    });

    for (let level = 1; level <= 6; level += 1) {
      expect(container.querySelector(`.cm-note-heading-${level}`)).toBeTruthy();
    }
    expect(container.querySelectorAll('[role="textbox"]')).toHaveLength(1);
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("switches between live preview and Markdown source without changing editor state", async () => {
    const value = "# Heading\n\n- [ ] task\n\n**bold**";
    const onChange = vi.fn();
    const { container, view } = await renderNotes({ value, onChange });
    view.dispatch({ selection: { anchor: value.indexOf("task") + 2 } });

    expect(container.querySelector(".cm-note-heading")).toBeTruthy();
    expect(container.querySelector(".cm-note-task")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Show Markdown source" }));

    expect(container.querySelector(".cm-note-heading")).toBeNull();
    expect(container.querySelector(".cm-note-task")).toBeNull();
    expect(view.state.doc.toString()).toBe(value);
    expect(view.state.selection.main.head).toBe(value.indexOf("task") + 2);
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole("button", { name: "Show live preview" }));

    expect(container.querySelector(".cm-note-heading")).toBeTruthy();
    expect(container.querySelector(".cm-note-task")).toBeTruthy();
    expect(view.state.doc.toString()).toBe(value);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders task and bullet widgets and shows help on hover", async () => {
    const { container } = await renderNotes({
      value: "- [ ] Buy milk\n- todo 2\n  - nested todo\n---\n**bold** *italic* `code` [link](https://example.com)",
      onChange: vi.fn(),
      label: "Daily Notes"
    });

    expect(container.querySelector(".cm-note-task")).toBeTruthy();
    expect(
      Array.from(container.querySelectorAll(".cm-note-list-marker-visual"), (marker) => marker.textContent)
    ).toEqual(["•", "•"]);
    expect(container.querySelector(".cm-note-rule")).toBeTruthy();
    expect(container.querySelector(".cm-note-strong")).toBeTruthy();
    expect(container.querySelector(".cm-note-emphasis")).toBeTruthy();
    expect(container.querySelector(".cm-note-inline-code")).toBeTruthy();
    expect(container.querySelector(".cm-note-link")?.textContent).toBe("link");
    expect(container.textContent).toContain("Buy milk");
    expect(container.textContent).toContain("todo 2");

    const helpBtn = screen.getByRole("button", { name: "Formatting help" });
    await fireEvent.mouseEnter(helpBtn.parentElement);
    expect(screen.getByText("Formatting Guide")).toBeTruthy();
  });

  it("updates the canonical Markdown when clicking a task widget", async () => {
    const onChange = vi.fn();
    const { view } = await renderNotes({ value: "- [ ] Todo item\n* List item", onChange });

    view.focus();
    view.dispatch({ selection: { anchor: 8 } });
    const taskButton = screen.getByRole("checkbox", { name: "Mark task complete" });
    expect(taskButton.tagName).toBe("BUTTON");
    expect(taskButton.querySelector("svg").style.visibility).toBe("hidden");

    await fireEvent.click(taskButton);
    expect(onChange).toHaveBeenLastCalledWith("- [x] Todo item\n* List item");
    const checkedButton = screen.getByRole("checkbox", { name: "Mark task incomplete" });
    expect(checkedButton.classList.contains("checked")).toBe(true);
    expect(checkedButton.querySelector("svg")).toBeTruthy();
    expect(checkedButton.querySelector("svg").style.visibility).toBe("");
  });

  it("emits the complete continuous document for an editor transaction", async () => {
    const onChange = vi.fn();
    const { view } = await renderNotes({ value: "Before\n**Current**\nAfter", onChange });
    const from = view.state.doc.toString().indexOf("Current");

    view.dispatch({ changes: { from, to: from + 7, insert: "Updated" } });

    expect(view.state.doc.toString()).toBe("Before\n**Updated**\nAfter");
    expect(onChange).toHaveBeenLastCalledWith("Before\n**Updated**\nAfter");
  });

  it("continues Markdown lists on Enter and exits an empty list item", async () => {
    const onChange = vi.fn();
    const { textbox, view } = await renderNotes({ value: "", onChange });
    const cases = [
      ["- item", "- item\n- "],
      ["  - nested", "  - nested\n  - "],
      ["1. item", "1. item\n2. "],
      ["9) item", "9) item\n10) "],
      ["- [x] task", "- [x] task\n- [ ] "],
      ["- Intro\n\n- [ ] first\n- [ ] second", "- Intro\n\n- [ ] first\n- [ ] second\n- [ ] "],
      ["- item\n- ", "- item\n"]
    ];

    for (const [before, after] of cases) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: before },
        selection: { anchor: before.length }
      });
      await fireEvent.keyDown(textbox, { key: "Enter", code: "Enter" });
      expect(view.state.doc.toString()).toBe(after);
    }
  });

  it("preserves a five-backtick fenced block and reveals its exact source when active", async () => {
    const value = "Before\n`````js\n```inner```\nconst value = 1;\n`````\nAfter";
    const { container, view } = await renderNotes({ value, onChange: vi.fn() });

    expect(container.querySelectorAll(".cm-note-codeblock")).toHaveLength(4);
    expect(container.querySelector(".cm-note-codeblock-first")).toBeTruthy();
    expect(container.querySelector(".cm-note-codeblock-last")).toBeTruthy();
    expect(view.state.doc.toString()).toBe(value);

    const anchor = value.indexOf("inner");
    view.focus();
    view.dispatch({ selection: { anchor } });
    expect(container.textContent).toContain("`````js");
    expect(container.textContent).toContain("`````");
    expect(view.state.doc.toString()).toBe(value);
  });

  it("offers cut, copy, and paste through the shared context menu adapter", async () => {
    const onChange = vi.fn();
    const { textbox, view } = await renderNotes({ value: "Alpha text", onChange, label: "Weekly notes" });

    view.dispatch({ selection: { anchor: 6, head: 10 } });
    await fireEvent.contextMenu(textbox, { clientX: 20, clientY: 30 });

    const menu = screen.getByRole("menu", { name: "Notes text actions" });
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent.trim())).toEqual(["Cut", "Copy", "Paste"]);
    expect(within(menu).queryByText("Select All")).toBeNull();

    await fireEvent.click(within(menu).getByRole("menuitem", { name: "Cut" }));
    expect(writeText).toHaveBeenCalledWith("text");
    expect(onChange).toHaveBeenLastCalledWith("Alpha ");

    readText.mockResolvedValue("notes");
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    await fireEvent.contextMenu(textbox, { clientX: 20, clientY: 30 });
    await fireEvent.click(screen.getByRole("menuitem", { name: "Paste" }));
    expect(onChange).toHaveBeenLastCalledWith("Alpha notes");
  });

  it("synchronizes a real external value without echoing it through onChange", async () => {
    const onChange = vi.fn();
    const rendered = await renderNotes({ value: "alpha", onChange });
    rendered.view.dispatch({ selection: { anchor: 3 } });

    await rendered.rerender({ value: "a much longer external value", onChange });
    await tick();

    expect(rendered.view.state.doc.toString()).toBe("a much longer external value");
    expect(rendered.view.state.selection.main.head).toBe(3);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("sidebar keyboard file navigation", () => {
  const weeks = () => [
    {
      path: "new", name: "2026w25", indexPath: "new/index.md",
      days: [
        { path: "new/1.md", date: "2026-06-22" },
        { path: "new/2.md", date: "2026-06-23" }
      ]
    },
    {
      path: "old", name: "2026w24", indexPath: "old/index.md",
      days: [{ path: "old/1.md", date: "2026-06-15" }]
    }
  ];

  it("navigates logical files across collapsed weeks in the active sort order", async () => {
    appStore.currentView = "day";
    workspaceStore.weeks = weeks();
    let selectedPath = "new/2.md";
    let view;
    const onSelectWeek = vi.fn(async (week) => {
      selectedPath = week.indexPath;
      await view.rerender({ open: true, selectedPath, onSelectWeek, onSelectDay });
    });
    const onSelectDay = vi.fn(async (day) => {
      selectedPath = day.path;
      await view.rerender({ open: true, selectedPath, onSelectWeek, onSelectDay });
    });
    view = render(AppSidebar, { open: true, selectedPath, onSelectWeek, onSelectDay });

    await fireEvent.click(screen.getByRole("button", { name: "Collapse all weeks" }));
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    await vi.waitFor(() => expect(onSelectWeek).toHaveBeenCalledWith(expect.objectContaining({ name: "2026w24" })));
    expect(screen.getByRole("button", { name: "2026w25" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "2026w24" }).getAttribute("aria-expanded")).toBe("false");

    selectedPath = "old/1.md";
    await view.rerender({ open: true, selectedPath, onSelectWeek, onSelectDay });
    await fireEvent.click(screen.getByRole("button", { name: /Week order:/ }));
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    await vi.waitFor(() => expect(onSelectWeek).toHaveBeenLastCalledWith(expect.objectContaining({ name: "2026w25" })));
  });

  it("moves in both directions, skips missing entries, and stops at boundaries", async () => {
    appStore.currentView = "day";
    workspaceStore.weeks = [{
      path: "week", name: "2026w25", indexPath: "week/index.md",
      days: [
        { path: "week/1.md", date: "2026-06-22" },
        { path: "week/3.md", date: "2026-06-24" }
      ]
    }];
    let selectedPath = "week/3.md";
    let view;
    const onSelectWeek = vi.fn(async (week) => {
      selectedPath = week.indexPath;
      await view.rerender({ selectedPath, onSelectWeek, onSelectDay });
    });
    const onSelectDay = vi.fn(async (day) => {
      selectedPath = day.path;
      await view.rerender({ selectedPath, onSelectWeek, onSelectDay });
    });
    view = render(AppSidebar, { selectedPath, onSelectWeek, onSelectDay });

    await fireEvent.keyDown(window, { key: "PageUp", ctrlKey: true });
    await vi.waitFor(() => expect(onSelectDay).toHaveBeenLastCalledWith(expect.objectContaining({ path: "week/1.md" }), expect.anything()));
    await fireEvent.keyDown(window, { key: "PageUp", ctrlKey: true });
    await vi.waitFor(() => expect(onSelectWeek).toHaveBeenCalledOnce());
    await fireEvent.keyDown(window, { key: "PageUp", ctrlKey: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSelectWeek).toHaveBeenCalledOnce();

    selectedPath = "week/3.md";
    await view.rerender({ selectedPath, onSelectWeek, onSelectDay });
    const dayCalls = onSelectDay.mock.calls.length;
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSelectDay).toHaveBeenCalledTimes(dayCalls);
  });

  it("suppresses navigation in Todo, Settings, dialogs, and menus", async () => {
    workspaceStore.weeks = weeks();
    const onSelectWeek = vi.fn();
    const onSelectDay = vi.fn();
    const view = render(AppSidebar, { selectedPath: "new/index.md", onSelectWeek, onSelectDay });

    appStore.currentView = "todo";
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    appStore.currentView = "week";
    await view.rerender({ selectedPath: "new/index.md", onSelectWeek, onSelectDay, keyboardNavigationEnabled: false });
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });

    await view.rerender({ selectedPath: "new/index.md", onSelectWeek, onSelectDay, keyboardNavigationEnabled: true });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    dialog.remove();
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    document.body.append(menu);
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    menu.remove();

    expect(onSelectWeek).not.toHaveBeenCalled();
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it("settles an active editor and serializes rapid repeated navigation", async () => {
    appStore.currentView = "week";
    workspaceStore.weeks = weeks();
    const input = document.createElement("input");
    let editSettled = false;
    input.addEventListener("blur", () => setTimeout(() => { editSettled = true; }, 150));
    document.body.append(input);
    input.focus();

    const resolvers = [];
    const onSelectWeek = vi.fn(() => new Promise((resolve) => resolvers.push(resolve)));
    const onSelectDay = vi.fn(() => new Promise((resolve) => resolvers.push(resolve)));
    render(AppSidebar, { selectedPath: "new/index.md", onSelectWeek, onSelectDay });

    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    await vi.waitFor(() => expect(onSelectDay).toHaveBeenCalledTimes(1));
    expect(editSettled).toBe(true);
    expect(onSelectDay.mock.calls[0][0].path).toBe("new/1.md");

    resolvers.shift()();
    await vi.waitFor(() => expect(onSelectDay).toHaveBeenCalledTimes(2));
    expect(onSelectDay.mock.calls[1][0].path).toBe("new/2.md");
    resolvers.shift()();
    await vi.waitFor(() => expect(onSelectWeek).toHaveBeenCalledTimes(1));
    expect(onSelectWeek.mock.calls[0][0].indexPath).toBe("old/index.md");
    resolvers.shift()();
  });
});
