// @ts-nocheck
import { markdownToTasks, tasksToMarkdown } from "./todoParser.js";
import { createTask } from "./todoTasks.js";
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
  view = "tasks";
  tasks = $state([]);
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
      this.tasks = markdownToTasks(content);
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
    return this.persistence.schedule(tasksToMarkdown(this.tasks), immediate);
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
      this.tasks = markdownToTasks(content);
      this.resetHistory();
      this.persistence.reset(this.loadedPath, content);
      this.appStore.showStatus("Reloaded");
    }
    return Boolean(content);
  }

  async resolveConflict(choice) {
    const content = await this.persistence.resolve(choice);
    if (choice === "reload" && typeof content === "string") {
      this.tasks = markdownToTasks(content);
      this.resetHistory();
    }
    return content !== null;
  }

  toggleTask(id) {
    const task = this.tasks.find((item) => item.id === id);
    if (!task) return;
    this.record({ type: "toggle", id, oldChecked: task.checked, newChecked: !task.checked });
    task.checked = !task.checked;
    void this.scheduleSave({ immediate: true });
  }

  updateText(id, text) {
    const task = this.tasks.find((item) => item.id === id);
    if (task && task.text !== text) {
      task.text = text;
      void this.scheduleSave();
    }
  }

  commitTextEdit(id, oldText, newText) {
    if (oldText !== newText) this.record({ type: "edit", id, oldText, newText });
  }

  moveTaskUp(index) {
    if (index <= 0) return;
    this.record({ type: "move", fromIndex: index, toIndex: index - 1 });
    [this.tasks[index - 1], this.tasks[index]] = [this.tasks[index], this.tasks[index - 1]];
    void this.scheduleSave({ immediate: true });
  }

  moveTaskDown(index) {
    if (index >= this.tasks.length - 1) return;
    this.record({ type: "move", fromIndex: index, toIndex: index + 1 });
    [this.tasks[index], this.tasks[index + 1]] = [this.tasks[index + 1], this.tasks[index]];
    void this.scheduleSave({ immediate: true });
  }

  deleteTask(index) {
    const task = this.tasks[index];
    if (!task) return;
    this.record({ type: "delete", index, task });
    this.tasks.splice(index, 1);
    void this.scheduleSave({ immediate: true });
  }

  indentTask(id) {
    const task = this.tasks.find((item) => item.id === id);
    if (!task) return;
    this.record({ type: "indent", id, oldIndent: task.indent, newIndent: task.indent + 1 });
    task.indent += 1;
    void this.scheduleSave({ immediate: true });
  }

  outdentTask(id) {
    const task = this.tasks.find((item) => item.id === id);
    if (!task || task.indent <= 0) return;
    this.record({ type: "indent", id, oldIndent: task.indent, newIndent: task.indent - 1 });
    task.indent -= 1;
    void this.scheduleSave({ immediate: true });
  }

  addTask(index, indent = 0) {
    const task = createTask(indent);
    const insertIndex = index === -1 ? this.tasks.length : index + 1;
    this.record({ type: "add", index: insertIndex, task });
    this.tasks.splice(insertIndex, 0, task);
    void this.scheduleSave({ immediate: true });
    return task.id;
  }

  clearCompleted() {
    const deletedTasks = this.tasks.map((task, index) => ({ task, index })).filter(({ task }) => task.isTask && task.checked);
    if (!deletedTasks.length) {
      this.appStore.showStatus("No completed tasks to clear");
      return false;
    }
    this.record({ type: "clear_completed", deletedTasks });
    this.tasks = this.tasks.filter((task) => !task.isTask || !task.checked);
    void this.scheduleSave({ immediate: true });
    this.appStore.showStatus(`Cleared ${deletedTasks.length} completed ${deletedTasks.length === 1 ? "task" : "tasks"}`);
    return true;
  }

  async undo() {
    if (!this.undoStack.length || !(await this.flushSave())) return;
    const action = this.undoStack.pop();
    this.tasks = applyAction(this.tasks, action, true);
    this.redoStack.push(action);
    await this.scheduleSave({ immediate: true });
    this.appStore.showStatus("Undone");
  }

  async redo() {
    if (!this.redoStack.length || !(await this.flushSave())) return;
    const action = this.redoStack.pop();
    this.tasks = applyAction(this.tasks, action, false);
    this.undoStack.push(action);
    await this.scheduleSave({ immediate: true });
    this.appStore.showStatus("Redone");
  }
}

export const todoStore = new TodoStore();
