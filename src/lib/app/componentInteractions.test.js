// @vitest-environment jsdom
// @ts-nocheck
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import MainTabs from "./MainTabs.svelte";
import AppHeader from "./AppHeader.svelte";
import AppSidebar from "./AppSidebar.svelte";
import SettingsPanel from "./SettingsPanel.svelte";
import FileTree from "$lib/shared/components/FileTree.svelte";
import ActivityRow from "$lib/features/daily/components/ActivityRow.svelte";
import PlanSection from "$lib/features/weekly/components/PlanSection.svelte";
import ObjectiveRow from "$lib/features/weekly/components/ObjectiveRow.svelte";
import TodoPanel from "$lib/features/todo/components/TodoPanel.svelte";
import TodoToolbar from "$lib/features/todo/components/TodoToolbar.svelte";
import { todoFoldStore } from "$lib/features/todo/todoFolding.svelte.js";
import { todoUiState } from "$lib/features/todo/todoUiState.svelte.js";
import { todoStore } from "$lib/features/todo/todoStore.svelte.js";
import { workspaceStore } from "./workspaceStore.svelte.js";
import { appStore } from "./appStore.svelte.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  workspaceStore.unavailable = false;
  workspaceStore.weeks = [];
  workspaceStore.todoExists = false;
  appStore.logsRootPath = "";
  appStore.filePath = "";
  todoStore.fileMissing = false;
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

  it("renders a zero-minute default when TimeInput has no minutes prop", async () => {
    const { default: TimeInput } = await import("$lib/shared/components/TimeInput.svelte");
    render(TimeInput, { onChange: vi.fn(), variant: "badge" });
    expect(screen.getByRole("button", { name: "Edit minutes spent" }).textContent.trim()).toBe("0m");
  });

  it("emits Weekly plan edits", async () => {
    const onUpdate = vi.fn();
    render(PlanSection, {
      plan: [{ id: "plan-1", day: "Mon", session: "Development", subjects: ["rust"], targetMinutes: 60 }],
      onAdd: vi.fn(), onUpdate, onDelete: vi.fn()
    });
    await fireEvent.click(screen.getByRole("button", { name: "Development" }));
    await fireEvent.input(screen.getByPlaceholderText("What session?"), { target: { value: "Review" } });
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

describe("todo actions", () => {
  it("emits row deletion for the selected todo index", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: (text) => ({ width: text.length * 7 })
    });
    const { default: TodoRow } = await import("$lib/features/todo/components/TodoRow.svelte");
    const onDeleteTodo = vi.fn();
    render(TodoRow, {
      todo: { id: "todo-1", text: "Delete me", checked: false, indent: 0 },
      index: 2,
      inputElements: {},
      onToggleTodo: vi.fn(), onUpdateText: vi.fn(), onMoveTodoUp: vi.fn(), onMoveTodoDown: vi.fn(),
      onDeleteTodo, onFocus: vi.fn(), onBlur: vi.fn(), onKeyDown: vi.fn()
    });
    await fireEvent.click(screen.getByTitle("Delete"));
    expect(onDeleteTodo).toHaveBeenCalledWith(2);
    expect(screen.getByPlaceholderText("New todo").getAttribute("spellcheck")).toBeNull();
  });

  it("deletes the focused row from the todo store through its trash button", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: (text) => ({ width: text.length * 7 })
    });
    const originalTodos = todoStore.todos;
    const originalUndoStack = todoStore.undoStack;
    const originalRedoStack = todoStore.redoStack;
    todoStore.todos = [
      { id: "todo-1", isTodo: true, text: "Keep", checked: false, indent: 0 },
      { id: "todo-2", isTodo: true, text: "Delete", checked: false, indent: 0 }
    ];
    todoStore.undoStack = [];
    todoStore.redoStack = [];
    vi.spyOn(todoStore, "scheduleSave").mockResolvedValue(true);
    const deleteTodo = vi.spyOn(todoStore, "deleteTodo");
    try {
      render(TodoPanel);
      const input = screen.getByDisplayValue("Delete");
      const trash = screen.getAllByRole("button", { name: "Delete todo" })[1];
      input.focus();
      await fireEvent.pointerDown(trash);
      expect(document.activeElement).toBe(input);
      await fireEvent.click(trash);

      expect(deleteTodo).toHaveBeenCalledWith(1);
      expect(todoStore.todos.map((todo) => todo.id)).toEqual(["todo-1"]);
    } finally {
      todoStore.todos = originalTodos;
      todoStore.undoStack = originalUndoStack;
      todoStore.redoStack = originalRedoStack;
    }
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
    const deleteTodo = vi.spyOn(todoStore, "deleteTodo").mockImplementation(() => {});
    try {
      render(TodoPanel);
      await fireEvent.click(screen.getByRole("button", { name: "Collapse todo" }));
      await fireEvent.click(screen.getAllByRole("button", { name: "Delete todo" })[1]);
      expect(deleteTodo).toHaveBeenCalledWith(2);
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
      await fireEvent.click(screen.getByRole("menuitem", { name: /Delete selected/ }));

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
  it("keeps workspace selection out of the sidebar and creates week files from one action", async () => {
    const createCurrentWeekFiles = vi.spyOn(workspaceStore, "createCurrentWeekFiles").mockResolvedValue(true);
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });

    expect(screen.queryByRole("button", { name: "Select workspace folder" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Initialize current week/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Fill in missing files/ })).toBeNull();

    await fireEvent.click(screen.getByRole("button", { name: "Create week files" }));

    expect(createCurrentWeekFiles).toHaveBeenCalledOnce();
  });

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
});

describe("NotesEditor interactions", () => {
  it("renders preview mode by default and shows help on hover", async () => {
    const { default: NotesEditor } = await import("$lib/shared/components/NotesEditor.svelte");
    const onChange = vi.fn();
    render(NotesEditor, { value: "- [ ] Buy milk\n- todo 2", onChange, label: "Daily Notes" });

    // Expect label to be correct
    expect(screen.getByText("Daily Notes")).toBeTruthy();

    // Check preview items
    expect(screen.getByText("Buy milk")).toBeTruthy();
    expect(screen.getByText("todo 2")).toBeTruthy();

    // Trigger help popover hover
    const helpBtn = screen.getByRole("button", { name: "Formatting help" });
    await fireEvent.mouseEnter(helpBtn.parentElement);
    expect(screen.getByText("Formatting Guide")).toBeTruthy();
  });

  it("updates raw text directly when clicking a preview checkbox", async () => {
    const { default: NotesEditor } = await import("$lib/shared/components/NotesEditor.svelte");
    const onChange = vi.fn();
    render(NotesEditor, { value: "- [ ] Todo item\n* List item", onChange });

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.checked).toBe(false);

    await fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith("- [x] Todo item\n* List item");
  });

  it("opens edit mode with focused textarea when clicking a line", async () => {
    const { default: NotesEditor } = await import("$lib/shared/components/NotesEditor.svelte");
    const onChange = vi.fn();
    render(NotesEditor, { value: "- [ ] Item 1\n- Item 2\n\nSome text here", onChange });

    // Click the paragraph text to enter edit mode
    await fireEvent.click(screen.getByText("Some text here"));

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeTruthy();
    expect(textarea.value).toBe("- [ ] Item 1\n- Item 2\n\nSome text here");
  });
});
