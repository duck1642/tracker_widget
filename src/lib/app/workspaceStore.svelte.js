// @ts-nocheck
import { appStore } from "./appStore.svelte.js";
import * as workspaceService from "$lib/shared/services/logWorkspaceService.js";
import * as fileService from "$lib/shared/services/fileService.js";
import { planLegacyDailyMigration, planLegacyWeeklyMigration } from "$lib/migration/migrationPlanner.js";
import { getWeekDescriptor } from "$lib/shared/services/logWorkspaceService.js";

class WorkspaceStore {
  weeks = $state([]);
  loading = $state(false);
  unavailable = $state(false);
  sidebarOpen = $state(true);
  migrationReport = $state(null);

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

  async dryRunMigration() {
    const files = this.weeks.flatMap((week) => [
      ...week.days.map((day) => ({ ...day, kind: "daily" })),
      ...(week.indexPath ? [{ path: week.indexPath, name: `${week.name}_index.md`, kind: "weekly", week }] : [])
    ]);
    const entries = [];
    for (const file of files) {
      try {
        const content = await fileService.readFile(file.path);
        const result = file.kind === "weekly"
          ? planLegacyWeeklyMigration(content, getWeekDescriptor(file.week.days[0]?.date ? new Date(`${file.week.days[0].date}T12:00:00`) : new Date()))
          : planLegacyDailyMigration(content, file.date);
        entries.push({ file, ...result });
      } catch (error) {
        entries.push({ file, status: "ambiguous", issues: [String(error)], output: null });
      }
    }
    this.migrationReport = {
      entries,
      current: entries.filter((entry) => entry.status === "current").length,
      migratable: entries.filter((entry) => entry.status === "migratable").length,
      ambiguous: entries.filter((entry) => entry.status === "ambiguous").length
    };
    return this.migrationReport;
  }

  async applyMigration() {
    const changes = (this.migrationReport?.entries || []).filter((entry) => entry.status === "migratable").map((entry) => ({ path: entry.file.path, content: entry.output }));
    if (!changes.length) return false;
    try {
      const backup = await fileService.applyLogMigration(appStore.logsRootPath, changes);
      appStore.showStatus(`Migrated ${changes.length}; backup created`);
      this.migrationReport = { ...this.migrationReport, backup, applied: true };
      await this.refresh();
      return true;
    } catch (error) {
      appStore.showStatus("Migration failed: " + error);
      return false;
    }
  }
}

export const workspaceStore = new WorkspaceStore();
