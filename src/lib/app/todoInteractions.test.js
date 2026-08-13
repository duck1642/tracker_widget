// @vitest-environment jsdom
// @ts-nocheck
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
import { todoFoldStore } from "$lib/features/todo/todoFolding.svelte.js";
import { todoUiState } from "$lib/features/todo/todoUiState.svelte.js";
import { todoStore } from "$lib/features/todo/todoStore.svelte.js";
import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
import { workspaceStore } from "./workspaceStore.svelte.js";
import { appStore } from "./appStore.svelte.js";
import { subjectHistoryStore } from "./subjectHistoryStore.svelte.js";
import { sessionHistoryStore } from "./sessionHistoryStore.svelte.js";
import { scratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.js";
import { formatDate, getWeekDescriptor } from "$lib/shared/services/logWorkspaceService.js";
import * as logWorkspaceService from "$lib/shared/services/logWorkspaceService.js";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openPath } from "@tauri-apps/plugin-opener";
import { EditorView } from "@codemirror/view";

import { installInteractionTestSetup } from './interactionTestSetup.js';

installInteractionTestSetup();

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

  it("renders selected count in the Todo toolbar instead of the title", () => {
    render(TodoToolbar, {
      selectedCount: 2,
      onAddTodo: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      onReload: vi.fn(),
      onClearCompleted: vi.fn()
    });

    expect(screen.getByText("2 selected")).toBeTruthy();
  });

});
