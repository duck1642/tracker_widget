// @ts-nocheck
import * as defaultSubjectHistoryService from "$lib/shared/services/subjectHistoryService.js";
import { appStore } from "./appStore.svelte.js";

export class SubjectHistoryStore {
  history = $state({ subjects: {} });
  loaded = $state(false);
  loading = $state(false);
  rebuilding = $state(false);

  constructor({ subjectHistoryService = defaultSubjectHistoryService, appStore = null } = {}) {
    this.subjectHistoryService = subjectHistoryService;
    this.appStore = appStore;
  }

  get suggestions() {
    return Object.entries(this.history.subjects || {})
      .map(([subject, entry]) => ({ subject, count: entry.count || 0, lastUsed: entry.last_used || "" }))
      .sort((left, right) =>
        right.count - left.count
        || right.lastUsed.localeCompare(left.lastUsed)
        || left.subject.localeCompare(right.subject, undefined, { sensitivity: "base" })
      )
      .map((entry) => entry.subject);
  }

  async load(rootPath = "") {
    if (this.loading) return false;
    this.loading = true;
    try {
      this.history = await this.subjectHistoryService.readSubjectHistory(rootPath);
      this.loaded = true;
      return true;
    } catch (error) {
      this.appStore?.showStatus?.("Subject history load failed: " + error);
      return false;
    } finally {
      this.loading = false;
    }
  }

  async rebuild(rootPath = "") {
    if (this.rebuilding) return false;
    this.rebuilding = true;
    try {
      this.history = await this.subjectHistoryService.rebuildSubjectHistory(rootPath);
      this.loaded = true;
      this.appStore?.showStatus?.(`Subject history rebuilt: ${this.suggestions.length} ${this.suggestions.length === 1 ? "subject" : "subjects"}`);
      return true;
    } catch (error) {
      this.appStore?.showStatus?.("Subject history rebuild failed: " + error);
      return false;
    } finally {
      this.rebuilding = false;
    }
  }

  async record(subjects) {
    const cleaned = [...new Set(subjects.map((subject) => subject.trim()).filter(Boolean))];
    if (!cleaned.length) return false;
    try {
      this.history = await this.subjectHistoryService.recordSubjects(cleaned);
      this.loaded = true;
      return true;
    } catch {
      return false;
    }
  }
}

export const subjectHistoryStore = new SubjectHistoryStore({ appStore });
