import { markdownToTasks, tasksToMarkdown } from "$lib/utils/parser.js";
import { getLogPath } from "$lib/utils/paths.js";
import { createTask } from "$lib/utils/tasks.js";
import { applyAction } from "$lib/utils/actions.js";
import * as fileService from "$lib/services/fileService.js";
import { appStore } from "$lib/stores/appStore.js";

class DocumentStore {
  /** @type {any[]} */
  tasks = $state([]);
  lastModified = $state(0);
  /** @type {any[]} */
  redoStack = $state([]);

  get logPath() {
    return getLogPath(appStore.filePath);
  }

  async loadFile() {
    if (!appStore.filePath) {
      const defaultPath = await fileService.getDefaultPath();
      appStore.filePath = defaultPath;
      await appStore.saveConfig();
    }
    
    try {
      const content = await fileService.readFile(appStore.filePath);
      this.tasks = markdownToTasks(content);
      this.lastModified = await fileService.getFileModifiedTime(appStore.filePath);
      appStore.showStatus("Loaded");
      return true;
    } catch (err) {
      appStore.showStatus("Err: " + err);
      return false;
    }
  }

  async saveFile() {
    try {
      const content = tasksToMarkdown(this.tasks);
      await fileService.writeFile(appStore.filePath, content);
      this.lastModified = await fileService.getFileModifiedTime(appStore.filePath);
      appStore.showStatus("Saved");
    } catch (err) {
      appStore.showStatus("Err: " + err);
    }
  }

  /** @param {any} action */
  async logAction(action) {
    try {
      this.redoStack = [];
      await fileService.logHistory(this.logPath, JSON.stringify(action));
    } catch (err) {
      appStore.showStatus("Err log: " + err);
    }
  }

  /** @param {string} id */
  toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      this.logAction({ type: "toggle", id: task.id, oldChecked: task.checked, newChecked: !task.checked });
      task.checked = !task.checked;
      this.saveFile();
    }
  }

  /**
   * @param {string} id
   * @param {string} text
   */
  updateText(id, text) {
    const task = this.tasks.find(t => t.id === id);
    if (task && task.text !== text) {
      task.text = text;
      this.saveFile();
    }
  }

  /** @param {number} index */
  moveTaskUp(index) {
    if (index <= 0) return;
    this.logAction({ type: "move", fromIndex: index, toIndex: index - 1 });
    const temp = this.tasks[index];
    this.tasks[index] = this.tasks[index - 1];
    this.tasks[index - 1] = temp;
    this.saveFile();
  }

  /** @param {number} index */
  moveTaskDown(index) {
    if (index >= this.tasks.length - 1) return;
    this.logAction({ type: "move", fromIndex: index, toIndex: index + 1 });
    const temp = this.tasks[index];
    this.tasks[index] = this.tasks[index + 1];
    this.tasks[index + 1] = temp;
    this.saveFile();
  }

  /** @param {number} index */
  async deleteTask(index) {
    const taskToDelete = this.tasks[index];
    if (taskToDelete) {
      await this.logAction({ type: "delete", index: index, task: taskToDelete });
      this.tasks.splice(index, 1);
      this.saveFile();
    }
  }

  /** @param {string} id */
  indentTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      this.logAction({ type: "indent", id: task.id, oldIndent: task.indent, newIndent: task.indent + 1 });
      task.indent += 1;
      this.saveFile();
    }
  }

  /** @param {string} id */
  outdentTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task && task.indent > 0) {
      this.logAction({ type: "indent", id: task.id, oldIndent: task.indent, newIndent: task.indent - 1 });
      task.indent -= 1;
      this.saveFile();
    }
  }

  /**
   * @param {number} index
   * @param {number} [indent]
   */
  addTask(index, indent = 0) {
    const newTask = createTask(indent);
    const insertIndex = index === -1 ? this.tasks.length : index + 1;
    this.logAction({ type: "add", index: insertIndex, task: newTask });
    this.tasks.splice(insertIndex, 0, newTask);
    this.saveFile();
    return newTask.id;
  }

  async clearCompleted() {
    const completedTasks = this.tasks
      .map((t, i) => ({ task: t, index: i }))
      .filter(x => x.task.isTask && x.task.checked);
    
    if (completedTasks.length === 0) return;
    
    await this.logAction({ type: "clear_completed", deletedTasks: completedTasks });
    this.tasks = this.tasks.filter(t => !t.isTask || !t.checked);
    this.saveFile();
  }

  async undo() {
    try {
      const poppedLine = await fileService.popHistory(this.logPath);
      const action = JSON.parse(poppedLine);
      this.tasks = applyAction(this.tasks, action, true);
      this.redoStack.push(action);
      this.saveFile();
      appStore.showStatus("Undone");
    } catch (err) {
      const message = String(err);
      if (message.includes("No history") || message.includes("No such file")) {
        appStore.showStatus("No Undo");
      } else {
        appStore.showStatus("Err Undo: " + message);
      }
    }
  }

  async redo() {
    if (this.redoStack.length === 0) return;
    const action = this.redoStack.pop();
    this.tasks = applyAction(this.tasks, action, false);
    try {
      await fileService.logHistory(this.logPath, JSON.stringify(action));
    } catch (err) {
      appStore.showStatus("Err log: " + err);
    }
    this.saveFile();
    appStore.showStatus("Redone");
  }
}

export const documentStore = new DocumentStore();
