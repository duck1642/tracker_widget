// @ts-nocheck
import { appStore } from "./appStore.svelte.js";
import * as workspaceService from "$lib/shared/services/logWorkspaceService.js";
import * as fileService from "$lib/shared/services/fileService.js";
import { confirm } from "@tauri-apps/plugin-dialog";
import { todoStore } from "$lib/features/tasks/todoStore.svelte.js";

class WorkspaceStore {
  weeks = $state([]);
  loading = $state(false);
  unavailable = $state(false);
  sidebarOpen = $state(true);
  todoExists = $state(false);

  get hasWorkspacePath() {
    return Boolean(appStore.logsRootPath);
  }

  get workspaceAvailable() {
    return this.hasWorkspacePath && !this.unavailable;
  }

  get todoPath() {
    return workspaceService.todoPathForWorkspace(appStore.logsRootPath);
  }

  get weekCount() {
    return this.weeks.length;
  }

  get needsFirstSetup() {
    return !appStore.logsRootPath && !appStore.filePath;
  }

  async applyWorkspace(path) {
    appStore.logsRootPath = path;
    appStore.filePath = workspaceService.todoPathForWorkspace(path);
    await appStore.saveConfig();
    const ok = await this.refresh();
    if (this.todoExists) {
      await todoStore.loadFile();
    } else {
      todoStore.fileMissing = true;
      todoStore.loadedPath = "";
      todoStore.tasks = [];
      todoStore.resetHistory();
    }
    return ok;
  }

  async refresh() {
    if (!appStore.logsRootPath) {
      this.weeks = [];
      this.unavailable = true;
      this.todoExists = false;
      return false;
    }
    this.loading = true;
    try {
      this.weeks = await workspaceService.listLogTree(appStore.logsRootPath);
      this.todoExists = await workspaceService.pathExists(this.todoPath);
      this.unavailable = false;
      return true;
    } catch {
      this.weeks = [];
      this.todoExists = false;
      this.unavailable = true;
      return false;
    } finally {
      this.loading = false;
    }
  }

  async chooseRoot() {
    const selected = await workspaceService.selectLogsFolder();
    if (!selected) return false;
    return await this.applyWorkspace(selected);
  }

  async createTodo() {
    if (!this.workspaceAvailable) return false;
    try {
      const result = await workspaceService.createWorkspaceTodo(appStore.logsRootPath);
      appStore.filePath = result.path;
      await appStore.saveConfig();
      await this.refresh();
      await todoStore.loadFile();
      appStore.showStatus("Created todo.md");
      return true;
    } catch (error) {
      appStore.showStatus("Todo creation failed: " + error);
      return false;
    }
  }

  async importTodo({ replace = false } = {}) {
    if (!this.workspaceAvailable) return false;
    const selected = await workspaceService.selectTodoFile();
    if (!selected) return false;
    const destinationExists = await workspaceService.pathExists(this.todoPath);
    const shouldReplace = replace || destinationExists;
    if (destinationExists && !replace) {
      const ok = await confirm("Replace the existing workspace todo.md with the selected Markdown file?", { title: "Import Markdown", kind: "warning" });
      if (!ok) return false;
    }
    const content = await fileService.readFile(selected);
    if (workspaceService.countTodoItems(content) === 0) {
      const ok = await confirm("No checklist items were found. Import this Markdown file anyway?", { title: "Import Markdown", kind: "warning" });
      if (!ok) return false;
    }
    try {
      const result = await workspaceService.importWorkspaceTodo(appStore.logsRootPath, selected, shouldReplace);
      appStore.filePath = result.path;
      await appStore.saveConfig();
      await this.refresh();
      await todoStore.loadFile();
      appStore.showStatus(result.todoCount ? `Imported ${result.todoCount} todos` : "Imported Markdown with no todos");
      return result;
    } catch (error) {
      appStore.showStatus("Todo import failed: " + error);
      return false;
    }
  }

  async createCurrentWeek(missingOnly = false) {
    if (!appStore.logsRootPath) return false;
    try {
      const created = await workspaceService.createWeek(appStore.logsRootPath, new Date(), missingOnly);
      appStore.showStatus(created.length ? `Created ${created.length} files` : "Nothing missing");
      await this.refresh();
      return true;
    } catch (error) {
      appStore.showStatus("Week creation failed: " + error);
      return false;
    }
  }
}

export const workspaceStore = new WorkspaceStore();
