// @ts-nocheck
import * as defaultFileService from "$lib/shared/services/fileService.js";
import { PersistenceCoordinator } from "$lib/shared/persistence/persistenceCoordinator.js";
import { parseDailyLog, serializeDailyLog } from "./dailyLogParser.js";
import { appStore as defaultAppStore } from "$lib/app/appStore.svelte.js";
import { persistenceRegistry as defaultRegistry } from "$lib/app/persistenceRegistry.js";

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export class DailyStore {
  view = "day";
  path = $state("");
  date = $state("");
  sessions = $state([]);
  notesRaw = $state("");
  loaded = $state(false);
  dirty = $state(false);
  saving = $state(false);
  conflict = $state(null);

  constructor({ fileService = defaultFileService, appStore = defaultAppStore, registry = defaultRegistry, debounceMs = 250 } = {}) {
    this.fileService = fileService;
    this.appStore = appStore;
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
    registry.register(this);
  }

  get totalMinutes() {
    return this.sessions.reduce((total, session) => total + session.activities.reduce((sum, activity) => sum + activity.minutes, 0), 0);
  }

  document() {
    return { frontmatterRaw: this.frontmatterRaw || "", preambleRaw: this.preambleRaw || "", date: this.date, sessions: this.sessions, notesRaw: this.notesRaw };
  }

  async loadPath(path, date) {
    if (this.loaded && !(await this.flushSave())) return false;
    try {
      const content = await this.fileService.readFile(path);
      const parsed = parseDailyLog(content, date);
      this.path = path;
      this.date = parsed.date;
      this.sessions = parsed.sessions;
      this.notesRaw = parsed.notesRaw;
      this.frontmatterRaw = parsed.frontmatterRaw;
      this.preambleRaw = parsed.preambleRaw;
      this.loaded = true;
      this.persistence.reset(path, content);
      return true;
    } catch (error) {
      this.appStore.showStatus("Daily load failed: " + error);
      return false;
    }
  }

  save(immediate = false) {
    return this.persistence.schedule(serializeDailyLog(this.document()), immediate);
  }

  addSession(name) {
    const normalized = name.trim().normalize("NFC");
    if (!normalized || ["notes", "total time"].includes(normalized.toLowerCase())) return false;
    if (this.sessions.some((session) => session.name.toLowerCase() === normalized.toLowerCase())) return false;
    this.sessions.push({ id: id("session"), name: normalized, activities: [] });
    void this.save(true);
    return true;
  }

  removeSession(sessionId) {
    this.sessions = this.sessions.filter((session) => session.id !== sessionId);
    void this.save(true);
  }

  addActivity(sessionId) {
    const session = this.sessions.find((item) => item.id === sessionId);
    if (!session) return;
    session.activities.push({ id: id("activity"), subjects: ["general"], minutes: 1, description: "" });
    void this.save();
  }

  updateActivity(sessionId, activityId, patch) {
    const activity = this.sessions.find((item) => item.id === sessionId)?.activities.find((item) => item.id === activityId);
    if (!activity) return;
    Object.assign(activity, patch);
    void this.save();
  }

  removeActivity(sessionId, activityId) {
    const session = this.sessions.find((item) => item.id === sessionId);
    if (!session) return;
    session.activities = session.activities.filter((item) => item.id !== activityId);
    void this.save(true);
  }

  updateNotes(value) {
    this.notesRaw = value;
    void this.save();
  }

  flushSave() {
    return this.persistence.flush();
  }

  async checkExternalChanges() {
    const content = await this.persistence.checkExternal();
    if (typeof content === "string") {
      await this.applyExternal(content);
      this.persistence.reset(this.path, content);
    }
    return Boolean(content);
  }

  async resolveConflict(choice) {
    const content = await this.persistence.resolve(choice);
    if (choice === "reload" && typeof content === "string") await this.applyExternal(content);
  }

  async applyExternal(content) {
    const parsed = parseDailyLog(content, this.date);
    this.sessions = parsed.sessions;
    this.notesRaw = parsed.notesRaw;
    this.frontmatterRaw = parsed.frontmatterRaw;
    this.preambleRaw = parsed.preambleRaw;
  }
}

export const dailyStore = new DailyStore();
