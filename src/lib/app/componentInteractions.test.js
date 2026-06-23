// @vitest-environment jsdom
// @ts-nocheck
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import MainTabs from "./MainTabs.svelte";
import AppHeader from "./AppHeader.svelte";
import AppSidebar from "./AppSidebar.svelte";
import FileTree from "$lib/shared/components/FileTree.svelte";
import ActivityRow from "$lib/features/daily/components/ActivityRow.svelte";
import PlanSection from "$lib/features/weekly/components/PlanSection.svelte";
import ObjectiveRow from "$lib/features/weekly/components/ObjectiveRow.svelte";
import TasksPanel from "$lib/features/tasks/components/TasksPanel.svelte";
import { todoStore } from "$lib/features/tasks/todoStore.svelte.js";
import { workspaceStore } from "./workspaceStore.svelte.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  workspaceStore.unavailable = false;
  workspaceStore.weeks = [];
});

describe("application navigation", () => {
  it("changes the main view from the tab bar", async () => {
    const onSelect = vi.fn();
    render(MainTabs, { currentView: "tasks", onSelect });
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
      dragEnabled: true, layerMode: "normal", statusMessage: "", title: "Tasks", showModeMenu: false,
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
      dragEnabled: true, layerMode: "normal", statusMessage: "", title: "Tasks", showModeMenu: true,
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
      dragEnabled: true, layerMode: "normal", statusMessage: "", title: "Tasks", showModeMenu: true,
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

describe("logger editing", () => {
  it("emits Daily activity edits", async () => {
    const onUpdate = vi.fn();
    render(ActivityRow, { activity: { subjects: ["rust"], minutes: 20, description: "Old" }, onUpdate, onDelete: vi.fn() });
    
    // Open minutes editor by clicking the badge
    await fireEvent.click(screen.getByLabelText("Edit minutes spent"));
    await fireEvent.input(screen.getByRole("spinbutton"), { target: { value: "45" } });
    
    // Open description editor by clicking the description text
    await fireEvent.click(screen.getByText("Old"));
    await fireEvent.input(screen.getByPlaceholderText("What happened?"), { target: { value: "New description" } });
    
    expect(onUpdate).toHaveBeenCalledWith({ minutes: 45 });
    expect(onUpdate).toHaveBeenCalledWith({ description: "New description" });
  });

  it("emits Weekly plan edits", async () => {
    const onUpdate = vi.fn();
    render(PlanSection, {
      plan: [{ id: "plan-1", day: "Mon", session: "Development", subjects: ["rust"], targetMinutes: 60 }],
      onAdd: vi.fn(), onUpdate, onDelete: vi.fn()
    });
    await fireEvent.input(screen.getByLabelText("Session"), { target: { value: "Review" } });
    expect(onUpdate).toHaveBeenCalledWith("plan-1", { session: "Review" });
  });

  it("emits objective origin and status independently", async () => {
    const onUpdate = vi.fn();
    render(ObjectiveRow, {
      objective: { subjects: ["rust"], origin: "planned", status: "open", description: "Ship" },
      onUpdate, onDelete: vi.fn()
    });
    await fireEvent.click(screen.getByRole("button", { name: "Planned" }));
    
    // Open status dropdown
    await fireEvent.click(screen.getByLabelText("Status"));
    // Select Partial status
    await fireEvent.click(screen.getByRole("menuitem", { name: "Partial" }));
    
    expect(onUpdate).toHaveBeenCalledWith({ origin: "unplanned" });
    expect(onUpdate).toHaveBeenCalledWith({ status: "partial" });
  });
});

describe("task actions", () => {
  it("emits row deletion for the selected task index", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: (text) => ({ width: text.length * 7 })
    });
    const { default: TaskRow } = await import("$lib/features/tasks/components/TaskRow.svelte");
    const onDeleteTask = vi.fn();
    render(TaskRow, {
      task: { id: "task-1", text: "Delete me", checked: false, indent: 0 },
      index: 2,
      inputElements: {},
      onToggleTask: vi.fn(), onUpdateText: vi.fn(), onMoveTaskUp: vi.fn(), onMoveTaskDown: vi.fn(),
      onDeleteTask, onFocus: vi.fn(), onBlur: vi.fn(), onKeyDown: vi.fn()
    });
    await fireEvent.click(screen.getByTitle("Delete"));
    expect(onDeleteTask).toHaveBeenCalledWith(2);
    expect(screen.getByPlaceholderText("New Task").getAttribute("spellcheck")).toBeNull();
  });

  it("deletes the focused row from the task store through its trash button", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: (text) => ({ width: text.length * 7 })
    });
    const originalTasks = todoStore.tasks;
    const originalUndoStack = todoStore.undoStack;
    const originalRedoStack = todoStore.redoStack;
    todoStore.tasks = [
      { id: "task-1", isTask: true, text: "Keep", checked: false, indent: 0 },
      { id: "task-2", isTask: true, text: "Delete", checked: false, indent: 0 }
    ];
    todoStore.undoStack = [];
    todoStore.redoStack = [];
    vi.spyOn(todoStore, "scheduleSave").mockResolvedValue(true);
    const deleteTask = vi.spyOn(todoStore, "deleteTask");
    try {
      render(TasksPanel);
      const input = screen.getByDisplayValue("Delete");
      const trash = screen.getAllByRole("button", { name: "Delete task" })[1];
      input.focus();
      await fireEvent.pointerDown(trash);
      expect(document.activeElement).toBe(input);
      await fireEvent.click(trash);

      expect(deleteTask).toHaveBeenCalledWith(1);
      expect(todoStore.tasks.map((task) => task.id)).toEqual(["task-1"]);
    } finally {
      todoStore.tasks = originalTasks;
      todoStore.undoStack = originalUndoStack;
      todoStore.redoStack = originalRedoStack;
    }
  });

  it("deletes an empty task with Backspace and focuses the previous task", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: (text) => ({ width: text.length * 7 })
    });
    const originalTasks = todoStore.tasks;
    todoStore.tasks = [
      { id: "task-1", isTask: true, text: "Previous", checked: false, indent: 0 },
      { id: "task-2", isTask: true, text: "", checked: false, indent: 0 }
    ];
    const deleteTask = vi.spyOn(todoStore, "deleteTask").mockImplementation((index) => todoStore.tasks.splice(index, 1));
    try {
      render(TasksPanel);
      const emptyTask = screen.getAllByPlaceholderText("New Task")[1];
      emptyTask.focus();
      await fireEvent.keyDown(emptyTask, { key: "Backspace" });

      expect(deleteTask).toHaveBeenCalledWith(1);
      expect(document.activeElement).toBe(screen.getByDisplayValue("Previous"));
    } finally {
      todoStore.tasks = originalTasks;
    }
  });

});

describe("unavailable logs folder", () => {
  it("offers locate, select, and retry actions", async () => {
    workspaceStore.unavailable = true;
    const chooseRoot = vi.spyOn(workspaceStore, "chooseRoot").mockResolvedValue(true);
    const refresh = vi.spyOn(workspaceStore, "refresh").mockResolvedValue(true);
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn(), onClose: vi.fn() });
    const recovery = screen.getByText("Logs folder unavailable").parentElement;
    await fireEvent.click(within(recovery).getByRole("button", { name: "Locate existing" }));
    await fireEvent.click(within(recovery).getByRole("button", { name: "Select new" }));
    await fireEvent.click(within(recovery).getByRole("button", { name: "Retry" }));
    expect(chooseRoot).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe("sidebar sorting", () => {
  it("toggles between newest-first and oldest-first", async () => {
    workspaceStore.weeks = [
      { path: "new", name: "2026w25", indexPath: null, days: [] },
      { path: "old", name: "2025w52", indexPath: null, days: [] }
    ];
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });
    const labels = () => screen.getAllByRole("button", { name: /20\d\dw\d\d/ }).map((button) => button.textContent.trim());
    expect(labels()).toEqual(["2026w25", "2025w52"]);
    await fireEvent.click(screen.getByRole("button", { name: "Toggle week sorting" }));
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
    await fireEvent.click(screen.getByRole("button", { name: "Toggle week sorting" }));
    await fireEvent.click(screen.getByRole("button", { name: "2025w52" }));
    expect(labels()).toEqual(["2025w52", "2026w25"]);
    expect(screen.getByRole("button", { name: "2025w52" }).getAttribute("aria-expanded")).toBe("false");

    await view.rerender({ ...props, open: false });
    await view.rerender({ ...props, open: true });

    expect(labels()).toEqual(["2025w52", "2026w25"]);
    expect(screen.getByRole("button", { name: "2025w52" }).getAttribute("aria-expanded")).toBe("false");
  });

});
