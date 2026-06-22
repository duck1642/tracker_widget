// @ts-nocheck
import { appStore } from "./appStore.svelte.js";
import * as workspaceService from "$lib/shared/services/logWorkspaceService.js";

class WorkspaceStore {
  weeks = $state([]);
  loading = $state(false);
  unavailable = $state(false);
  sidebarOpen = $state(true);

  async refresh() {
    if (!appStore.logsRootPath) {
      this.weeks = [];
      this.unavailable = true;
      return false;
    }
    this.loading = true;
    try {
      this.weeks = await workspaceService.listLogTree(appStore.logsRootPath);
      this.unavailable = false;
      return true;
    } catch {
      this.weeks = [];
      this.unavailable = true;
      return false;
    } finally {
      this.loading = false;
    }
  }

  async chooseRoot() {
    const selected = await workspaceService.selectLogsFolder();
    if (!selected) return false;
    appStore.logsRootPath = selected;
    await appStore.saveConfig();
    return await this.refresh();
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
