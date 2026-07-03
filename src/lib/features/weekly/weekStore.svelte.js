// @ts-nocheck
import * as defaultFileService from "$lib/shared/services/fileService.js";
import { PersistenceCoordinator } from "$lib/shared/persistence/persistenceCoordinator.js";
import { parseWeeklyIndex, serializeWeeklyIndex } from "./weeklyIndexParser.js";
import { parseDailyLog } from "$lib/features/daily/dailyLogParser.js";
import { aggregateWeeklyActual } from "./actualAggregator.js";
import { appStore as defaultAppStore } from "$lib/app/appStore.svelte.js";
import { persistenceRegistry as defaultRegistry } from "$lib/app/persistenceRegistry.js";
import { dayLabel } from "$lib/shared/services/logWorkspaceService.js";

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export class WeekStore {
  view = "week";
  path = $state("");
  descriptor = $state(null);
  objectives = $state([]);
  plan = $state([]);
  actual = $state([]);
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

  document() {
    return { frontmatterRaw: this.frontmatterRaw || "", preambleRaw: this.preambleRaw || "", unknownSectionsRaw: this.unknownSectionsRaw || [], isoWeek: this.descriptor, objectives: this.objectives, objectiveRawLines: this.objectiveRawLines || [], plan: this.plan, actual: this.actual, notesRaw: this.notesRaw };
  }

  async loadPath(path, descriptor, days = []) {
    if (this.loaded && !(await this.flushSave())) return false;
    try {
      const content = await this.fileService.readFile(path);
      const parsed = parseWeeklyIndex(content, descriptor);
      this.path = path;
      this.descriptor = descriptor;
      this.objectives = parsed.objectives;
      this.objectiveRawLines = parsed.objectiveRawLines;
      this.plan = parsed.plan;
      this.actual = parsed.actual;
      this.notesRaw = parsed.notesRaw;
      this.frontmatterRaw = parsed.frontmatterRaw;
      this.preambleRaw = parsed.preambleRaw;
      this.unknownSectionsRaw = parsed.unknownSectionsRaw;
      this.loaded = true;
      this.persistence.reset(path, content);
      await this.refreshActual(days);
      return true;
    } catch (error) {
      this.appStore.showStatus("Week load failed: " + error);
      return false;
    }
  }

  save(immediate = false) {
    return this.persistence.schedule(serializeWeeklyIndex(this.document()), immediate);
  }

  addObjective() {
    this.objectives.push({ id: id("objective"), subjects: ["general"], origin: "planned", status: "open", description: "" });
    void this.save();
  }

  addObjectives(descriptions) {
    const cleaned = descriptions.map((description) => description.trim()).filter(Boolean);
    if (!cleaned.length) return false;
    this.objectives.push(...cleaned.map((description) => ({
      id: id("objective"),
      subjects: ["general"],
      origin: "planned",
      status: "open",
      description
    })));
    void this.save();
    return true;
  }

  updateObjective(objectiveId, patch) {
    const objective = this.objectives.find((item) => item.id === objectiveId);
    if (!objective) return;
    Object.assign(objective, patch);
    void this.save();
  }

  removeObjective(objectiveId) {
    this.objectives = this.objectives.filter((item) => item.id !== objectiveId);
    void this.save(true);
  }

  addPlanEntry(day = "Mon") {
    this.plan.push({ id: id("plan"), day, session: "Session", subjects: ["general"], targetMinutes: 0 });
    void this.save();
  }

  updatePlanEntry(entryId, patch) {
    const entry = this.plan.find((item) => item.id === entryId);
    if (!entry) return;
    Object.assign(entry, patch);
    void this.save();
  }

  removePlanEntry(entryId) {
    this.plan = this.plan.filter((item) => item.id !== entryId);
    void this.save(true);
  }

  updateNotes(value) {
    this.notesRaw = value;
    void this.save();
  }

  suggestionsFor() {
    const seen = new Set();
    return this.plan
      .map((entry) => entry.session.trim())
      .filter((session) => {
        if (!session) return false;
        const key = session.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  async refreshActual(days = this.dayEntries || []) {
    this.dayEntries = days;
    const parsedDays = [];
    for (const day of days) {
      try {
        const content = await this.fileService.readFile(day.path);
        const parsed = parseDailyLog(content, day.date);
        parsedDays.push({ day: dayLabel(new Date(`${day.date}T12:00:00`)), sessions: parsed.sessions });
      } catch {
        // Missing or locked daily files are omitted from Actual.
      }
    }
    this.actual = aggregateWeeklyActual(this.plan, parsedDays);
    if (this.loaded) await this.save(true);
  }

  flushSave() {
    return this.persistence.flush();
  }

  async checkExternalChanges() {
    const content = await this.persistence.checkExternal();
    if (typeof content === "string") {
      this.applyExternal(content);
      this.persistence.reset(this.path, content);
    }
    return Boolean(content);
  }

  async resolveConflict(choice) {
    const content = await this.persistence.resolve(choice);
    if (choice === "reload" && typeof content === "string") this.applyExternal(content);
  }

  applyExternal(content) {
    const parsed = parseWeeklyIndex(content, this.descriptor);
    this.objectives = parsed.objectives;
    this.objectiveRawLines = parsed.objectiveRawLines;
    this.plan = parsed.plan;
    this.actual = parsed.actual;
    this.notesRaw = parsed.notesRaw;
    this.frontmatterRaw = parsed.frontmatterRaw;
    this.preambleRaw = parsed.preambleRaw;
    this.unknownSectionsRaw = parsed.unknownSectionsRaw;
  }
}

export const weekStore = new WeekStore();
