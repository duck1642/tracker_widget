// @ts-nocheck
import { markdownToTodos, todosToMarkdown } from "./todoParser.js";
import { createTodoItem } from "./todoItems.js";
import { applyAction } from "./todoActions.js";
import * as defaultFileService from "$lib/shared/services/fileService.js";
import { PersistenceCoordinator } from "$lib/shared/persistence/persistenceCoordinator.js";
import { appStore as defaultAppStore } from "$lib/app/appStore.svelte.js";
import { persistenceRegistry } from "$lib/app/persistenceRegistry.js";
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

  constructor({ fileService = defaultFileService, appStore = defaultAppStore, debounceMs = 250 } = {}) {
    this.fileService = fileService;
    this.appStore = appStore;
    this.loadedPath = "";
    this.persistence = new PersistenceCoordinator({
      fileService,
      debounceMs,
      onState: (state) => {
        this.dirty = state.dirty;
        this.saving = state.saving;
        this.conflict = state.conflict;
      },
      onStatus: (message) => this.appStore.showStatus(message)
    });
    persistenceRegistry.register(this);
  }

  resetHistory() {
    this.undoStack = [];
    this.redoStack = [];
  }

  record(action) {
    this.undoStack.push(cloneAction(action));
    this.redoStack = [];
  }

  async loadFile({ path } = {}) {
    let targetPath = path || this.appStore.filePath;
    if (!targetPath) {
      this.fileMissing = true;
      return false;
    }
    const exists = await this.fileService.pathExists(targetPath);
    if (!exists) {
      this.fileMissing = true;
      return false;
    }
    if (this.loadedPath && !(await this.flushSave())) return false;
    try {
      const content = await this.fileService.readFile(targetPath);
      this.loadedPath = targetPath;
      this.appStore.filePath = targetPath;
      this.todos = markdownToTodos(content);
      this.resetHistory();
      this.persistence.reset(targetPath, content);
      this.fileMissing = false;
      this.appStore.showStatus("Loaded");
      return true;
    } catch (error) {
      this.appStore.showStatus("Todo load failed: " + error);
      this.fileMissing = true;
      return false;
    }
  }

  async chooseFile() {
    const selected = await selectTodoFile();
    if (!selected) return false;
    const ok = await this.loadFile({ path: selected });
    if (ok) {
      this.fileMissing = false;
      await this.appStore.saveConfig();
    }
    return ok;
  }

  scheduleSave({ immediate = false } = {}) {
    return this.persistence.schedule(todosToMarkdown(this.todos), immediate);
  }

  saveFile() {
    return this.scheduleSave({ immediate: true });
  }

  flushSave() {
    return this.persistence.flush();
  }

  async checkExternalChanges() {
    const content = await this.persistence.checkExternal();
    if (typeof content === "string") {
      this.todos = markdownToTodos(content);
      this.resetHistory();
      this.persistence.reset(this.loadedPath, content);
      this.appStore.showStatus("Reloaded");
    }
    return Boolean(content);
  }

  async resolveConflict(choice) {
    const content = await this.persistence.resolve(choice);
    if (choice === "reload" && typeof content === "string") {
      this.todos = markdownToTodos(content);
      this.resetHistory();
    }
    return content !== null;
  }

  toggleTodo(id) {
    const todo = this.todos.find((item) => item.id === id);
    if (!todo) return;
    this.record({ type: "toggle", id, oldChecked: todo.checked, newChecked: !todo.checked });
    todo.checked = !todo.checked;
    void this.scheduleSave({ immediate: true });
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
    if (!this.undoStack.length || !(await this.flushSave())) return;
    const action = this.undoStack.pop();
    this.todos = applyAction(this.todos, action, true);
    this.redoStack.push(action);
    await this.scheduleSave({ immediate: true });
    this.appStore.showStatus("Undone");
  }

  async redo() {
    if (!this.redoStack.length || !(await this.flushSave())) return;
    const action = this.redoStack.pop();
    this.todos = applyAction(this.todos, action, false);
    this.undoStack.push(action);
    await this.scheduleSave({ immediate: true });
    this.appStore.showStatus("Redone");
  }
}

export const todoStore = new TodoStore();
