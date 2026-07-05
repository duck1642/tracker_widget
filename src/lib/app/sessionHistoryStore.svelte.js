// @ts-nocheck
import * as defaultSessionHistoryService from "$lib/shared/services/sessionHistoryService.js";

export class SessionHistoryStore {
  history = $state({ sessions: {} });
  loaded = $state(false);
  loading = $state(false);
  rebuilding = $state(false);

  constructor({ sessionHistoryService = defaultSessionHistoryService, appStore = null } = {}) {
    this.sessionHistoryService = sessionHistoryService;
    this.appStore = appStore;
  }

  get suggestions() {
    return Object.entries(this.history.sessions || {})
      .map(([session, entry]) => ({
        session,
        actualCount: entry.actual_count || 0,
        plannedCount: entry.planned_count || 0,
        lastUsed: entry.last_used || ""
      }))
      .sort((left, right) =>
        right.actualCount - left.actualCount
        || right.plannedCount - left.plannedCount
        || right.lastUsed.localeCompare(left.lastUsed)
        || left.session.localeCompare(right.session, undefined, { sensitivity: "base" })
      )
      .map((entry) => entry.session);
  }

  async load(rootPath = "") {
    if (this.loading) return false;
    this.loading = true;
    try {
      this.history = await this.sessionHistoryService.readSessionHistory(rootPath);
      this.loaded = true;
      return true;
    } catch (error) {
      this.appStore?.showStatus?.("Session history load failed: " + error);
      return false;
    } finally {
      this.loading = false;
    }
  }

  async rebuild(rootPath = "") {
    if (this.rebuilding) return false;
    this.rebuilding = true;
    try {
      this.history = await this.sessionHistoryService.rebuildSessionHistory(rootPath);
      this.loaded = true;
      this.appStore?.showStatus?.(`Session history rebuilt: ${this.suggestions.length} ${this.suggestions.length === 1 ? "session" : "sessions"}`);
      return true;
    } catch (error) {
      this.appStore?.showStatus?.("Session history rebuild failed: " + error);
      return false;
    } finally {
      this.rebuilding = false;
    }
  }

  async record(sessions) {
    const cleaned = [...new Set(sessions.map((session) => session.trim()).filter(Boolean))];
    if (!cleaned.length) return false;
    try {
      this.history = await this.sessionHistoryService.recordSessions(cleaned);
      this.loaded = true;
      return true;
    } catch {
      return false;
    }
  }
}

export const sessionHistoryStore = new SessionHistoryStore();
