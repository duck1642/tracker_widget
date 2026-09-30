// @ts-nocheck
import { markdownToTodos, todosToMarkdown } from "./todoParser.js";
import { createTodoItem } from "./todoItems.js";
import { applyAction } from "./todoActions.js";
import * as defaultFileService from "$lib/shared/services/fileService.js";
import { DocumentController, documentSucceeded } from "$lib/shared/persistence/documentController.js";
import { appStore as defaultAppStore } from "$lib/app/appStore.svelte.js";
import { persistenceRegistry as defaultRegistry } from "$lib/app/persistenceRegistry.js";
import { selectTodoFile } from "$lib/shared/services/logWorkspaceService.js";

function cloneAction(action) {
  return JSON.parse(JSON.stringify(action));
}

export class TodoStore {
  view = "todo";
  todos = $state([]);
  undoStack = $state([]);
  redoStack = $state([]);
  dirty = $state(false);
  saving = $state(false);
  conflict = $state(null);
  fileMissing = $state(false);
  loading = $state(false);
  error = $state(null);

  constructor({ fileService = defaultFileService, appStore = defaultAppStore, registry = defaultRegistry, debounceMs = 250 } = {}) {
    this.fileService = fileService;
    this.appStore = appStore;
    this.loadedPath = "";
    this.persistence = new DocumentController({
      fileService,
      debounceMs,
      loadLabel: "Todo",
      prepare: (content) => markdownToTodos(content),
      apply: (todos, { path, reason }) => {
        this.todos = todos;
        this.appStore.filePath = path;
        this.resetHistory();
        this.appStore.showStatus(reason === "open" ? "Loaded" : "Reloaded");
      },
      clear: () => { this.todos = []; this.resetHistory(); },
      onState: (state) => {
        this.loadedPath = state.loaded ? state.path : "";
        this.loading = state.loading;
        this.error = state.error;
        this.fileMissing = state.missing;
        this.dirty = state.dirty;
        this.saving = state.saving;
        this.conflict = state.conflict;
      },
      onStatus: (message) => this.appStore.showStatus(message)
    });
    registry.register(this);
  }

  resetHistory() {
    this.undoStack = [];
    this.redoStack = [];
  }

  record(action) {
    this.undoStack.push(cloneAction(action));
    this.redoStack = [];
  }

  async loadFile({ path, isCurrent } = {}) {
    return documentSucceeded(await this.persistence.open(path || this.appStore.filePath, { isCurrent }));
  }

  async chooseFile() {
    const selected = await selectTodoFile();
    if (!selected) return false;
    const ok = await this.loadFile({ path: selected });
    if (ok) {
      await this.appStore.saveConfig();
    }
    return ok;
  }

  scheduleSave({ immediate = false } = {}) {
    this.persistence.setDraft(todosToMarkdown(this.todos));
    return immediate ? this.flushSave() : Promise.resolve(!this.conflict);
  }

  saveFile() {
    return this.scheduleSave({ immediate: true });
  }

  async flushSave() {
    return documentSucceeded(await this.persistence.flush());
  }

  async checkExternalChanges() {
    return Boolean((await this.persistence.checkExternal()).applied);
  }

  async resolveConflict(choice) {
    return documentSucceeded(await this.persistence.resolveConflict(choice));
  }

  async unload() {
    return documentSucceeded(await this.persistence.close());
  }

  toggleTodo(id) {
    const todo = this.todos.find((item) => item.id === id);
    if (!todo) return;
    this.record({ type: "toggle", id, oldChecked: todo.checked, newChecked: !todo.checked });
    todo.checked = !todo.checked;
    void this.scheduleSave({ immediate: true });
  }

  setTodosCheckedByIds(ids, checked) {
    const selectedIds = new Set(ids);
    const changedTodos = this.todos
      .filter((todo) => todo.isTodo && selectedIds.has(todo.id) && todo.checked !== checked)
      .map((todo) => ({ id: todo.id, oldChecked: todo.checked, newChecked: checked }));
    if (!changedTodos.length) return false;
    this.record({ type: "set_checked_many", todos: changedTodos });
    const changedIds = new Set(changedTodos.map((todo) => todo.id));
    for (const todo of this.todos) {
      if (changedIds.has(todo.id)) todo.checked = checked;
    }
    void this.scheduleSave({ immediate: true });
    this.appStore.showStatus(`${checked ? "Checked" : "Unchecked"} ${changedTodos.length} ${changedTodos.length === 1 ? "todo" : "todos"}`);
    return true;
  }

  updateText(id, text) {
    const todo = this.todos.find((item) => item.id === id);
    if (todo && todo.text !== text) {
      todo.text = text;
      void this.scheduleSave();
    }
  }

  commitTextEdit(id, oldText, newText) {
    if (oldText !== newText) this.record({ type: "edit", id, oldText, newText });
  }

  moveTodoUp(index) {
    this.moveTodoTo(index, index - 1);
  }

  moveTodoDown(index) {
    this.moveTodoTo(index, index + 1);
  }

  moveTodoTo(fromIndex, toIndex) {
    if (fromIndex === toIndex) return false;
    if (fromIndex < 0 || fromIndex >= this.todos.length || toIndex < 0 || toIndex >= this.todos.length) return false;
    const [todo] = this.todos.splice(fromIndex, 1);
    this.todos.splice(toIndex, 0, todo);
    this.record({ type: "move_to", fromIndex, toIndex });
    void this.scheduleSave({ immediate: true });
    return true;
  }

  deleteTodo(index) {
    const todo = this.todos[index];
    if (!todo) return;
    this.record({ type: "delete", index, todo });
    this.todos.splice(index, 1);
    void this.scheduleSave({ immediate: true });
  }

  deleteTodosByIds(ids) {
    const idsToDelete = new Set(ids);
    const deletedTodos = this.todos
      .map((todo, index) => ({ todo, index }))
      .filter(({ todo }) => todo.isTodo && idsToDelete.has(todo.id));
    if (!deletedTodos.length) return false;
    const deletedIds = new Set(deletedTodos.map(({ todo }) => todo.id));
    this.record({ type: "delete_many", deletedTodos });
    this.todos = this.todos.filter((todo) => !deletedIds.has(todo.id));
    void this.scheduleSave({ immediate: true });
    this.appStore.showStatus(`Deleted ${deletedTodos.length} ${deletedTodos.length === 1 ? "todo" : "todos"}`);
    return true;
  }

  indentTodo(id) {
    const todo = this.todos.find((item) => item.id === id);
    if (!todo) return;
    this.record({ type: "indent", id, oldIndent: todo.indent, newIndent: todo.indent + 1 });
    todo.indent += 1;
    void this.scheduleSave({ immediate: true });
  }

  outdentTodo(id) {
    const todo = this.todos.find((item) => item.id === id);
    if (!todo || todo.indent <= 0) return;
    this.record({ type: "indent", id, oldIndent: todo.indent, newIndent: todo.indent - 1 });
    todo.indent -= 1;
    void this.scheduleSave({ immediate: true });
  }

  shiftTodosIndentByIds(ids, delta) {
    const selectedIds = new Set(ids);
    const changedTodos = this.todos
      .filter((todo) => todo.isTodo && selectedIds.has(todo.id))
      .map((todo) => ({ id: todo.id, oldIndent: todo.indent, newIndent: Math.max(0, todo.indent + delta) }))
      .filter((todo) => todo.oldIndent !== todo.newIndent);
    if (!changedTodos.length) return false;
    this.record({ type: "shift_indent_many", todos: changedTodos });
    const nextIndents = new Map(changedTodos.map((todo) => [todo.id, todo.newIndent]));
    for (const todo of this.todos) {
      if (nextIndents.has(todo.id)) todo.indent = nextIndents.get(todo.id);
    }
    void this.scheduleSave({ immediate: true });
    this.appStore.showStatus(`${delta > 0 ? "Indented" : "Outdented"} ${changedTodos.length} ${changedTodos.length === 1 ? "todo" : "todos"}`);
    return true;
  }

  addTodo(index, indent = 0) {
    const todo = createTodoItem(indent);
    const insertIndex = index === -1 ? this.todos.length : index + 1;
    this.record({ type: "add", index: insertIndex, todo });
    this.todos.splice(insertIndex, 0, todo);
    void this.scheduleSave({ immediate: true });
    return todo.id;
  }

  clearCompleted() {
    const deletedTodos = this.todos.map((todo, index) => ({ todo, index })).filter(({ todo }) => todo.isTodo && todo.checked);
    if (!deletedTodos.length) {
      this.appStore.showStatus("No completed todos to clear");
      return false;
    }
    this.record({ type: "clear_completed", deletedTodos });
    this.todos = this.todos.filter((todo) => !todo.isTodo || !todo.checked);
    void this.scheduleSave({ immediate: true });
    this.appStore.showStatus(`Cleared ${deletedTodos.length} completed ${deletedTodos.length === 1 ? "todo" : "todos"}`);
    return true;
  }

  async undo() {
    const generation = this.persistence.generation;
    if (!this.undoStack.length || !(await this.flushSave())) return;
    if (generation !== this.persistence.generation || !this.undoStack.length) return;
    const action = this.undoStack.pop();
    this.todos = applyAction(this.todos, action, true);
    this.redoStack.push(action);
    const saved = await this.scheduleSave({ immediate: true });
    if (saved && generation === this.persistence.generation) this.appStore.showStatus("Undone");
  }

  async redo() {
    const generation = this.persistence.generation;
    if (!this.redoStack.length || !(await this.flushSave())) return;
    if (generation !== this.persistence.generation || !this.redoStack.length) return;
    const action = this.redoStack.pop();
    this.todos = applyAction(this.todos, action, false);
    this.undoStack.push(action);
    const saved = await this.scheduleSave({ immediate: true });
    if (saved && generation === this.persistence.generation) this.appStore.showStatus("Redone");
  }
}

export const todoStore = new TodoStore();
