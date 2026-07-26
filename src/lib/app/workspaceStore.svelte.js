// @ts-nocheck
import { appStore } from "./appStore.svelte.js";
import * as workspaceService from "$lib/shared/services/logWorkspaceService.js";
import * as fileService from "$lib/shared/services/fileService.js";
import { confirm } from "@tauri-apps/plugin-dialog";
import { todoStore } from "$lib/features/todo/todoStore.svelte.js";
import { todoUiState } from "$lib/features/todo/todoUiState.svelte.js";

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
    todoUiState.clearSelection();
    appStore.logsRootPath = path;
    appStore.filePath = workspaceService.todoPathForWorkspace(path);
    await appStore.saveConfig();
    const ok = await this.refresh();
    if (this.todoExists) {
      await todoStore.loadFile();
    } else {
      todoStore.fileMissing = true;
      todoStore.loadedPath = "";
      todoStore.todos = [];
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
    todoUiState.clearSelection();
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
    todoUiState.clearSelection();
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

  async createWeekFiles(startDate, count = 1) {
    if (!appStore.logsRootPath) return false;
    try {
      const descriptors = workspaceService.getConsecutiveWeekDescriptors(startDate, count);
      let createdCount = 0;
      for (const descriptor of descriptors) {
        const created = await workspaceService.createWeek(
          appStore.logsRootPath,
          descriptor.start,
          appStore.frontmatterMode
        );
        createdCount += created.length;
      }
      const weekLabel = descriptors.length === 1 ? "1 week" : `${descriptors.length} weeks`;
      appStore.showStatus(createdCount
        ? `Created ${createdCount} files across ${weekLabel}`
        : `Nothing missing across ${weekLabel}`);
      await this.refresh();
      return true;
    } catch (error) {
      appStore.showStatus("Week creation failed: " + error);
      return false;
    }
  }

  createCurrentWeekFiles(referenceDate = new Date()) {
    return this.createWeekFiles(referenceDate, 1);
  }

  createNextWeekFiles(referenceDate = new Date()) {
    const nextMonday = workspaceService.getWeekDescriptor(referenceDate).start;
    nextMonday.setDate(nextMonday.getDate() + 7);
    return this.createWeekFiles(nextMonday, 1);
  }

  createSelectedWeekFiles(year, week, count = 1) {
    return this.createWeekFiles(workspaceService.dateForISOWeek(year, week), count);
  }

  async repairWeek(week) {
    if (!appStore.logsRootPath || !week?.name) return false;
    const match = week.name.match(/^(\d{4})w(\d{2})$/);
    if (!match) {
      appStore.showStatus("Week repair failed: invalid week folder");
      return false;
    }
    try {
      const date = workspaceService.dateForISOWeek(Number(match[1]), Number(match[2]));
      const created = await workspaceService.createWeek(
        appStore.logsRootPath,
        date,
        appStore.frontmatterMode
      );
      appStore.showStatus(created.length
        ? `Repaired ${created.length} ${created.length === 1 ? "file" : "files"} in ${week.name}`
        : `${week.name} is complete`);
      await this.refresh();
      return true;
    } catch (error) {
      appStore.showStatus("Week repair failed: " + error);
      return false;
    }
  }

  async convertWeekToPersonal(week) {
    if (!appStore.logsRootPath || !week?.name) return false;
    try {
      const summary = await workspaceService.convertWeekToPersonal(
        appStore.logsRootPath,
        week.name
      );
      const parts = [`Converted ${summary.converted} ${summary.converted === 1 ? "file" : "files"} in ${week.name}`];
      if (summary.alreadyPersonal) parts.push(`${summary.alreadyPersonal} already personal`);
      if (summary.skippedCustomFrontmatter) {
        parts.push(`${summary.skippedCustomFrontmatter} custom frontmatter skipped`);
      }
      appStore.showStatus(parts.join("; "));
      await this.refresh();
      return true;
    } catch (error) {
      appStore.showStatus("Personal conversion failed: " + error);
      return false;
    }
  }

  async recycleWeek(week) {
    if (!appStore.logsRootPath || !week?.name) return false;
    try {
      await workspaceService.recycleWeek(appStore.logsRootPath, week.name);
      await this.refresh();
      appStore.showStatus(`Moved ${week.name} to Recycle Bin`);
      return true;
    } catch (error) {
      appStore.showStatus("Week deletion failed: " + error);
      return false;
    }
  }
}

export const workspaceStore = new WorkspaceStore();
