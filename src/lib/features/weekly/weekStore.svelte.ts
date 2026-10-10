import type { ActivityFields, Objective, ObjectiveFields } from "$lib/shared/parsers/types.ts";
import type { DailySession } from "$lib/features/daily/types.ts";
import type { ActualDay, ActualEntry, ISOWeek, PlanEntry, WeekContext, WeeklyDocument } from "./types.ts";
import type { LogDayEntry, StatusSink } from "$lib/shared/services/types.ts";
import type { ConflictChoice, CurrentRequest, DocumentConflict, DocumentError, DocumentMeta, FileService } from "$lib/shared/persistence/documentController.ts";
import type { RegistrySink } from "$lib/app/persistenceRegistry.ts";
export interface WeekStoreOptions {
    fileService?: FileService;
    appStore?: StatusSink;
    registry?: RegistrySink;
    debounceMs?: number;
}
import * as defaultFileService from "$lib/shared/services/fileService.ts";
import { DocumentController, documentSucceeded } from "$lib/shared/persistence/documentController.ts";
import { parseWeeklyIndex, serializeWeeklyIndex } from "./weeklyIndexParser.ts";
import { parseDailyLog } from "$lib/features/daily/dailyLogParser.ts";
import { aggregateWeeklyActual } from "./actualAggregator.ts";
import { getFoldableObjectiveIds } from "./objectiveFolding.ts";
import { ObjectiveFoldSessionCache } from "./objectiveFoldSessionCache.ts";
import { appStore as defaultAppStore } from "$lib/app/appStore.svelte.ts";
import { persistenceRegistry as defaultRegistry } from "$lib/app/persistenceRegistry.ts";
import { dayLabel } from "$lib/shared/services/logWorkspaceService.ts";
import { movedByDirection } from "$lib/shared/utils/orderUtils.ts";

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function nextPlanId(plan: PlanEntry[]) {
  const highest = plan.reduce((max, entry) => {
    const match = String(entry.id || "").match(/^p(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `p${highest + 1}`;
}

const PLAN_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayOrder(day: string) {
  const index = PLAN_DAYS.indexOf(day);
  return index === -1 ? PLAN_DAYS.length : index;
}

function findLastPlanDayIndex(plan: PlanEntry[], day: string) {
  for (let index = plan.length - 1; index >= 0; index -= 1) {
    if (plan[index].day === day) return index;
  }
  return -1;
}

export class WeekStore {
  fileService:FileService; appStore:StatusSink; actualRequest:number; actualTask:Promise<void>;
  persistence:DocumentController<WeeklyDocument, WeekContext>; objectiveFoldCache:ObjectiveFoldSessionCache;
  frontmatterRaw=""; preambleRaw=""; unknownSectionsRaw:string[]=[]; objectiveRawLines:string[]=[]; dayEntries:LogDayEntry[]=[];
  view = "week" as const;
  path = $state("");
  descriptor = $state<ISOWeek | null>(null);
  objectives = $state<Objective[]>([]);
  plan = $state<PlanEntry[]>([]);
  actual = $state<ActualEntry[]>([]);
  notesRaw = $state("");
  loaded = $state(false);
  loading = $state(false);
  dirty = $state(false);
  saving = $state(false);
  conflict = $state<DocumentConflict | null>(null);
  missing = $state(false);
  error = $state<DocumentError | null>(null);
  foldedObjectiveIds = $state<string[]>([]);

  constructor({ fileService = defaultFileService, appStore = defaultAppStore, registry = defaultRegistry, debounceMs = 250 }: WeekStoreOptions = {}) {
    this.fileService = fileService;
    this.appStore = appStore;
    this.actualRequest = 0;
    this.actualTask = Promise.resolve();
    this.persistence = new DocumentController({
      fileService,
      debounceMs,
      loadLabel: "Week",
      prepare: (content, { context }) => {
        const descriptor = context?.descriptor || this.descriptor;
        if (!descriptor) throw new Error("Week descriptor is required");
        return parseWeeklyIndex(content, descriptor);
      },
      apply: (parsed, meta) => this.applyControllerContent(parsed, meta),
      clear: () => this.clearDomain(),
      afterApply: ({ path, context, reason }) => {
        if (reason === "open" || reason === "transfer") {
          this.launchActualRefresh(context?.days || [], path);
        }
      },
      onState: (state) => {
        this.path = state.path;
        this.loaded = state.loaded;
        this.loading = state.loading;
        this.dirty = state.dirty;
        this.saving = state.saving;
        this.conflict = state.conflict;
        this.missing = state.missing;
        this.error = state.error;
      },
      onStatus: (message) => this.appStore.showStatus(message)
    });
    this.objectiveFoldCache = new ObjectiveFoldSessionCache();
    registry.register(this);
  }

  document(): WeeklyDocument {
    if (!this.descriptor) throw new Error("No week is loaded");
    return { frontmatterRaw: this.frontmatterRaw || "", preambleRaw: this.preambleRaw || "", unknownSectionsRaw: this.unknownSectionsRaw || [], isoWeek: this.descriptor, objectives: this.objectives, objectiveRawLines: this.objectiveRawLines || [], plan: this.plan, actual: this.actual, notesRaw: this.notesRaw };
  }

  async loadPath(path: string, descriptor: ISOWeek, days: LogDayEntry[] = [], options: CurrentRequest = {}) {
    if (options.isCurrent && !options.isCurrent()) return false;
    const result = await this.persistence.open(path, { context: { descriptor, days }, isCurrent: options.isCurrent });
    if (!documentSucceeded(result)) return false;
    if (options.isCurrent && !options.isCurrent()) return false;
    // Focus follows the accepted document, not its asynchronous derived work.
    // flushSave waits for Actual whenever a completed save is required.
    return this.persistence.path === path && this.persistence.loaded && (!options.isCurrent || options.isCurrent());
  }

  save(immediate = false) {
    this.persistence.setDraft(serializeWeeklyIndex(this.document()));
    if (immediate) return this.persistence.flush().then(documentSucceeded);
    return true;
  }

  addObjective() {
    this.objectives.push({ id: id("objective"), subjects: ["general"], status: "open", description: "", indent: 0 });
    this.syncObjectiveFolds();
    void this.save();
  }

  addObjectives(descriptions: string[]) {
    const cleaned = descriptions.map((description) => description.trim()).filter(Boolean);
    if (!cleaned.length) return false;
    this.objectives.push(...cleaned.map((description) => ({
      id: id("objective"),
      subjects: ["general"],
      status: "open" as const,
      description,
      indent: 0
    })));
    this.syncObjectiveFolds();
    void this.save();
    return true;
  }

  updateObjective(objectiveId: string, patch: Partial<ObjectiveFields>) {
    const objective = this.objectives.find((item) => item.id === objectiveId);
    if (!objective) return;
    Object.assign(objective, patch);
    this.syncObjectiveFolds();
    void this.save();
  }

  removeObjective(objectiveId: string) {
    this.objectives = this.objectives.filter((item) => item.id !== objectiveId);
    this.syncObjectiveFolds();
    void this.save(true);
  }

  moveObjective(objectiveId: string, direction: "up" | "down") {
    const next = movedByDirection(this.objectives, objectiveId, direction);
    if (!next) return false;
    this.objectives = next;
    this.syncObjectiveFolds();
    void this.save(true);
    return true;
  }

  indentObjective(objectiveId: string) {
    const objective = this.objectives.find((item) => item.id === objectiveId);
    if (!objective || (objective.indent || 0) >= 2) return false;
    objective.indent = (objective.indent || 0) + 1;
    this.syncObjectiveFolds();
    void this.save(true);
    return true;
  }

  outdentObjective(objectiveId: string) {
    const objective = this.objectives.find((item) => item.id === objectiveId);
    if (!objective || (objective.indent || 0) <= 0) return false;
    objective.indent -= 1;
    this.syncObjectiveFolds();
    void this.save(true);
    return true;
  }

  addPlanEntry(day = "Mon") {
    this.plan.push({
      id: nextPlanId(this.plan),
      day,
      session: "Session",
      subjects: ["general"],
      targetMinutes: 0,
      activities: []
    });
    void this.save();
  }

  updatePlanEntry(entryId: string, patch: Partial<Omit<PlanEntry,"id">>) {
    const entry = this.plan.find((item) => item.id === entryId);
    if (!entry) return;
    Object.assign(entry, patch);
    void this.save();
  }

  removePlanEntry(entryId: string) {
    this.plan = this.plan.filter((item) => item.id !== entryId);
    void this.save(true);
  }

  duplicatePlanEntry(entryId: string) {
    const sourceIndex = this.plan.findIndex((entry) => entry.id === entryId);
    if (sourceIndex < 0) return false;
    const source = this.plan[sourceIndex];
    const duplicate = {
      ...source,
      id: nextPlanId(this.plan),
      subjects: [...(source.subjects || [])],
      activities: (source.activities || []).map((activity) => ({
        ...activity,
        id: id("plan-activity"),
        subjects: [...(activity.subjects || [])]
      }))
    };
    this.plan = [
      ...this.plan.slice(0, sourceIndex + 1),
      duplicate,
      ...this.plan.slice(sourceIndex + 1)
    ];
    void this.save(true);
    return true;
  }

  movePlanEntryWithinDay(sourceEntryId: string, targetEntryId: string, position: "before" | "after" = "before") {
    if (sourceEntryId === targetEntryId) return false;
    const source = this.plan.find((entry) => entry.id === sourceEntryId);
    const target = this.plan.find((entry) => entry.id === targetEntryId);
    if (!source || !target || source.day !== target.day) return false;
    const withoutSource = this.plan.filter((entry) => entry.id !== sourceEntryId);
    const targetIndex = withoutSource.findIndex((entry) => entry.id === targetEntryId);
    if (targetIndex < 0) return false;
    const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
    const next = [...withoutSource.slice(0, insertIndex), source, ...withoutSource.slice(insertIndex)];
    if (next.map((entry) => entry.id).join("\0") === this.plan.map((entry) => entry.id).join("\0")) return false;
    this.plan = next;
    void this.save(true);
    return true;
  }

  movePlanEntry(sourceEntryId: string, targetEntryId: string, position: "before" | "after" = "before") {
    if (sourceEntryId === targetEntryId) return false;
    const source = this.plan.find((entry) => entry.id === sourceEntryId);
    const target = this.plan.find((entry) => entry.id === targetEntryId);
    if (!source || !target) return false;
    const moved = { ...source, day: target.day };
    const withoutSource = this.plan.filter((entry) => entry.id !== sourceEntryId);
    const targetIndex = withoutSource.findIndex((entry) => entry.id === targetEntryId);
    if (targetIndex < 0) return false;
    const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
    const next = [...withoutSource.slice(0, insertIndex), moved, ...withoutSource.slice(insertIndex)];
    const sameOrder = next.map((entry) => `${entry.id}:${entry.day}`).join("\0") === this.plan.map((entry) => `${entry.id}:${entry.day}`).join("\0");
    if (sameOrder) return false;
    this.plan = next;
    void this.save(true);
    return true;
  }

  movePlanEntryToDay(sourceEntryId: string, targetDay: string) {
    const source = this.plan.find((entry) => entry.id === sourceEntryId);
    if (!source || !PLAN_DAYS.includes(targetDay)) return false;
    const moved = { ...source, day: targetDay };
    const withoutSource = this.plan.filter((entry) => entry.id !== sourceEntryId);
    const lastTargetDayIndex = findLastPlanDayIndex(withoutSource, targetDay);
    let insertIndex = lastTargetDayIndex >= 0 ? lastTargetDayIndex + 1 : withoutSource.findIndex((entry) => dayOrder(entry.day) > dayOrder(targetDay));
    if (insertIndex < 0) insertIndex = withoutSource.length;
    const next = [...withoutSource.slice(0, insertIndex), moved, ...withoutSource.slice(insertIndex)];
    const sameOrder = next.map((entry) => `${entry.id}:${entry.day}`).join("\0") === this.plan.map((entry) => `${entry.id}:${entry.day}`).join("\0");
    if (sameOrder) return false;
    this.plan = next;
    void this.save(true);
    return true;
  }

  addPlanActivity(entryId: string) {
    const entry = this.plan.find((item) => item.id === entryId);
    if (!entry) return;
    entry.activities = [...(entry.activities || []), { id: id("plan-activity"), subjects: ["general"], minutes: 0, description: "" }];
    this.plan = [...this.plan];
    void this.save();
  }

  addPlanActivities(entryId: string, descriptions: string[]) {
    const entry = this.plan.find((item) => item.id === entryId);
    const cleaned = descriptions.map((description) => description.trim()).filter(Boolean);
    if (!entry || !cleaned.length) return false;
    entry.activities = [
      ...(entry.activities || []),
      ...cleaned.map((description) => ({
        id: id("plan-activity"),
        subjects: ["general"],
        minutes: 0,
        description
      }))
    ];
    this.plan = [...this.plan];
    void this.save();
    return true;
  }

  updatePlanActivity(entryId: string, activityId: string, patch: Partial<ActivityFields>) {
    const activity = this.plan.find((entry) => entry.id === entryId)?.activities?.find((item) => item.id === activityId);
    if (!activity) return;
    Object.assign(activity, patch);
    void this.save();
  }

  removePlanActivity(entryId: string, activityId: string) {
    const entry = this.plan.find((item) => item.id === entryId);
    if (!entry) return;
    entry.activities = (entry.activities || []).filter((item) => item.id !== activityId);
    this.plan = [...this.plan];
    void this.save(true);
  }

  movePlanActivity(entryId: string, activityId: string, direction: "up" | "down") {
    const entry = this.plan.find((item) => item.id === entryId);
    if (!entry) return false;
    const next = movedByDirection(entry.activities || [], activityId, direction);
    if (!next) return false;
    entry.activities = next;
    this.plan = [...this.plan];
    void this.save(true);
    return true;
  }

  updateNotes(value: string) {
    this.notesRaw = value;
    void this.save();
  }

  setObjectiveFolds(ids: Iterable<string>) {
    const foldableIds = getFoldableObjectiveIds(this.objectives);
    this.foldedObjectiveIds = [...new Set(ids)].filter((id) => foldableIds.has(id));
    this.captureObjectiveFolds();
  }

  toggleObjectiveFold(objectiveId: string) {
    const next = this.foldedObjectiveIds.includes(objectiveId)
      ? this.foldedObjectiveIds.filter((id) => id !== objectiveId)
      : [...this.foldedObjectiveIds, objectiveId];
    this.setObjectiveFolds(next);
  }

  syncObjectiveFolds() {
    this.setObjectiveFolds(this.foldedObjectiveIds);
  }

  captureObjectiveFolds() {
    this.objectiveFoldCache.save(this.path, this.objectives, this.foldedObjectiveIds);
  }

  currentWeekSessionNames() {
    const seen = new Set<string>();
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

  async calculateActual(days = this.dayEntries || []) {
    const parsedDays: ActualDay[] = [];
    for (const day of days) {
      try {
        const content = await this.fileService.readFile(day.path);
        const parsed = parseDailyLog(content, day.date);
        parsedDays.push({ day: dayLabel(new Date(`${day.date}T12:00:00`)), sessions: parsed.sessions });
      } catch {
        // Missing or locked daily files are omitted from Actual.
      }
    }
    return aggregateWeeklyActual(this.plan, parsedDays);
  }

  launchActualRefresh(days: LogDayEntry[] = [], expectedPath = this.persistence.path) {
    const generation = this.persistence.generation;
    const path = expectedPath;
    const request = ++this.actualRequest;
    this.dayEntries = days;
    this.actualTask = (async () => {
      const actual = await this.calculateActual(days);
      if (request !== this.actualRequest || generation !== this.persistence.generation || path !== this.persistence.path || !this.persistence.loaded) return;
      this.actual = actual;
      await this.save(true);
    })();
    return this.actualTask;
  }

  refreshActual(days = this.dayEntries || []) {
    return this.launchActualRefresh(days);
  }

  async refreshActualWithDaily(date: string, sessions: DailySession[], days = this.dayEntries || []) {
    if (!this.persistence.loaded || !date) return;
    const generation = this.persistence.generation;
    const path = this.persistence.path;
    const request = ++this.actualRequest;
    this.dayEntries = days;
    this.actualTask = (async () => {
      const parsedDays: ActualDay[] = [];
      for (const day of days) {
        try {
          if (day.date === date) {
            parsedDays.push({ day: dayLabel(new Date(`${day.date}T12:00:00`)), sessions });
          } else {
            const content = await this.fileService.readFile(day.path);
            const parsed = parseDailyLog(content, day.date);
            parsedDays.push({ day: dayLabel(new Date(`${day.date}T12:00:00`)), sessions: parsed.sessions });
          }
        } catch {
          // Missing or locked daily files are omitted from Actual.
        }
      }
      const actual = aggregateWeeklyActual(this.plan, parsedDays);
      if (request !== this.actualRequest || generation !== this.persistence.generation || path !== this.persistence.path || !this.persistence.loaded) return;
      this.actual = actual;
      await this.save(true);
    })();
    return this.actualTask;
  }

  async flushSave() {
    while (true) {
      const task = this.actualTask;
      await task;
      if (task !== this.actualTask) continue;
      const result = await this.persistence.flush();
      if (task === this.actualTask) return documentSucceeded(result);
    }
  }

  async unload() {
    const result = await this.persistence.close();
    return documentSucceeded(result);
  }

  clearDomain() {
    this.objectiveFoldCache.delete(this.path);
    ++this.actualRequest;
    this.descriptor = null;
    this.objectives = [];
    this.objectiveRawLines = [];
    this.plan = [];
    this.actual = [];
    this.notesRaw = "";
    this.frontmatterRaw = "";
    this.preambleRaw = "";
    this.unknownSectionsRaw = [];
    this.foldedObjectiveIds = [];
  }

  async checkExternalChanges() {
    const result = await this.persistence.checkExternal();
    return Boolean(result.applied);
  }

  async resolveConflict(choice: ConflictChoice) {
    const result = await this.persistence.resolveConflict(choice);
    return documentSucceeded(result);
  }

  applyControllerContent(parsed: WeeklyDocument, { path, context, reason }: DocumentMeta<WeekContext>) {
    if (reason === "open" || reason === "transfer") {
      this.captureObjectiveFolds();
    } else {
      this.objectiveFoldCache.delete(path);
      this.foldedObjectiveIds = [];
    }
    this.applyParsed(path, context?.descriptor || this.descriptor, parsed);
  }

  applyParsed(path: string, descriptor: ISOWeek | null, parsed: WeeklyDocument) {
    this.descriptor = descriptor;
    this.objectives = parsed.objectives;
    this.objectiveRawLines = parsed.objectiveRawLines;
    this.plan = parsed.plan;
    this.actual = parsed.actual;
    this.notesRaw = parsed.notesRaw;
    this.frontmatterRaw = parsed.frontmatterRaw;
    this.preambleRaw = parsed.preambleRaw;
    this.unknownSectionsRaw = parsed.unknownSectionsRaw;
    this.foldedObjectiveIds = this.objectiveFoldCache.restore(path, this.objectives);
  }
}

export const weekStore = new WeekStore();
