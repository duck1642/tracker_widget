import * as defaultFileService from "$lib/shared/services/fileService.ts";
import { DocumentController, documentSucceeded } from "$lib/shared/persistence/documentController.ts";
import { parseDailyLog, serializeDailyLog } from "./dailyLogParser.ts";
import { appStore as defaultAppStore } from "$lib/app/appStore.svelte.ts";
import { persistenceRegistry as defaultRegistry } from "$lib/app/persistenceRegistry.ts";
import { weekStore as defaultWeekStore } from "$lib/features/weekly/weekStore.svelte.ts";
import { sessionHistoryStore as defaultSessionHistoryStore } from "$lib/app/sessionHistoryStore.svelte.ts";
import { movedByDirection } from "$lib/shared/utils/orderUtils.ts";
import { summarizeDurations } from "$lib/shared/utils/durationSummary.ts";
import type { DailyContext, DailyDocument, DailySession } from "./types.ts";
import type { ActivityFields } from "$lib/shared/parsers/types.ts";
import type { ConflictChoice, CurrentRequest, DocumentConflict, DocumentError, FileService } from "$lib/shared/persistence/documentController.ts";
import type { StatusSink } from "$lib/shared/services/types.ts";
import type { RegistrySink } from "$lib/app/persistenceRegistry.ts";

interface DailyWeekSink { loaded: boolean; refreshActualWithDaily(date: string, sessions: DailySession[]): Promise<unknown> }
interface SessionRecorder { record(names: string[]): Promise<unknown> }
export interface DailyStoreOptions {
  fileService?: FileService; appStore?: StatusSink; registry?: RegistrySink; debounceMs?: number;
  weekStore?: DailyWeekSink | null; sessionHistoryStore?: SessionRecorder | null;
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export class DailyStore {
  fileService: FileService;
  appStore: StatusSink;
  weekStore: DailyWeekSink | null;
  sessionHistoryStore: SessionRecorder | null;
  persistence: DocumentController<DailyDocument, DailyContext>;
  frontmatterRaw = "";
  preambleRaw = "";
  view = "day" as const;
  path = $state("");
  date = $state("");
  sessions = $state<DailySession[]>([]);
  notesRaw = $state("");
  loaded = $state(false);
  dirty = $state(false);
  saving = $state(false);
  conflict = $state<DocumentConflict | null>(null);
  loading = $state(false);
  missing = $state(false);
  error = $state<DocumentError | null>(null);

  constructor({ fileService = defaultFileService, appStore = defaultAppStore, registry = defaultRegistry, weekStore = defaultWeekStore, sessionHistoryStore = defaultSessionHistoryStore, debounceMs = 250 }: DailyStoreOptions = {}) {
    this.fileService = fileService;
    this.appStore = appStore;
    this.weekStore = weekStore;
    this.sessionHistoryStore = sessionHistoryStore;
    this.persistence = new DocumentController<DailyDocument, DailyContext>({
      fileService,
      debounceMs,
      loadLabel: "Daily",
      prepare: (content, { context }) => parseDailyLog(content, context?.date),
      apply: (parsed) => {
        this.date = parsed.date;
        this.sessions = parsed.sessions;
        this.notesRaw = parsed.notesRaw;
        this.frontmatterRaw = parsed.frontmatterRaw;
        this.preambleRaw = parsed.preambleRaw;
      },
      clear: () => {
        this.date = "";
        this.sessions = [];
        this.notesRaw = "";
        this.frontmatterRaw = "";
        this.preambleRaw = "";
      },
      onState: (state) => {
        this.path = state.path;
        this.loaded = state.loaded;
        this.loading = state.loading;
        this.missing = state.missing;
        this.error = state.error;
        this.dirty = state.dirty;
        this.saving = state.saving;
        this.conflict = state.conflict;
      },
      onStatus: (message) => this.appStore.showStatus(message)
    });
    registry.register(this);
  }

  get totalMinutes() {
    return this.durationSummary.knownMinutes;
  }

  get unknownDurationCount() {
    return this.durationSummary.unknownCount;
  }

  get durationSummary() {
    return summarizeDurations(this.sessions.flatMap((session) => session.activities.map((activity) => activity.minutes)));
  }

  document() {
    return { frontmatterRaw: this.frontmatterRaw || "", preambleRaw: this.preambleRaw || "", date: this.date, sessions: this.sessions, notesRaw: this.notesRaw };
  }

  async loadPath(path: string, date: string, { isCurrent }: CurrentRequest = {}) {
    return documentSucceeded(await this.persistence.open(path, { context: { date }, isCurrent }));
  }

  save(immediate = false) {
    this.persistence.setDraft(serializeDailyLog(this.document()));
    return immediate ? this.flushSave() : Promise.resolve(!this.conflict);
  }

  refreshWeeklyActual() {
    if (this.weekStore?.loaded) {
      void this.weekStore.refreshActualWithDaily(this.date, this.sessions);
    }
  }

  addSession(name: string) {
    const normalized = name.trim().normalize("NFC");
    if (!normalized || ["notes", "total time"].includes(normalized.toLowerCase())) return false;
    if (this.sessions.some((session) => session.name.toLowerCase() === normalized.toLowerCase())) return false;
    this.sessions.push({ id: id("session"), name: normalized, activities: [] });
    void this.save(true);
    void this.sessionHistoryStore?.record?.([normalized]);
    this.refreshWeeklyActual();
    return true;
  }

  removeSession(sessionId: string) {
    this.sessions = this.sessions.filter((session) => session.id !== sessionId);
    void this.save(true);
    this.refreshWeeklyActual();
  }

  moveSessionTo(sourceSessionId: string, targetSessionId: string, position: "before" | "after" = "before") {
    if (sourceSessionId === targetSessionId) return false;
    const source = this.sessions.find((session) => session.id === sourceSessionId);
    if (!source || !this.sessions.some((session) => session.id === targetSessionId)) return false;
    const withoutSource = this.sessions.filter((session) => session.id !== sourceSessionId);
    const targetIndex = withoutSource.findIndex((session) => session.id === targetSessionId);
    if (targetIndex < 0) return false;
    const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
    const next = [...withoutSource.slice(0, insertIndex), source, ...withoutSource.slice(insertIndex)];
    if (next.map((session) => session.id).join("\0") === this.sessions.map((session) => session.id).join("\0")) return false;
    this.sessions = next;
    void this.save(true);
    this.refreshWeeklyActual();
    return true;
  }

  renameSession(sessionId: string, name: string) {
    const normalized = name.trim().normalize("NFC");
    if (!normalized || ["notes", "total time"].includes(normalized.toLowerCase())) return false;
    if (this.sessions.some((session) => session.id !== sessionId && session.name.toLowerCase() === normalized.toLowerCase())) return false;
    const session = this.sessions.find((item) => item.id === sessionId);
    if (!session) return false;
    session.name = normalized;
    void this.save(true);
    if (session.activities.length > 0) {
      void this.sessionHistoryStore?.record?.([normalized]);
    }
    this.refreshWeeklyActual();
    return true;
  }

  addActivity(sessionId: string) {
    const session = this.sessions.find((item) => item.id === sessionId);
    if (!session) return;
    session.activities = [...session.activities, { id: id("activity"), subjects: ["general"], minutes: 0, description: "" }];
    this.sessions = [...this.sessions];
    void this.save();
    this.refreshWeeklyActual();
  }

  addActivities(sessionId: string, descriptions: string[]) {
    const session = this.sessions.find((item) => item.id === sessionId);
    const cleaned = descriptions.map((description) => description.trim()).filter(Boolean);
    if (!session || !cleaned.length) return false;
    session.activities = [...session.activities, ...cleaned.map((description) => ({
      id: id("activity"),
      subjects: ["general"],
      minutes: 0,
      description
    }))];
    this.sessions = [...this.sessions];
    void this.save();
    this.refreshWeeklyActual();
    return true;
  }

  updateActivity(sessionId: string, activityId: string, patch: Partial<ActivityFields>) {
    const activity = this.sessions.find((item) => item.id === sessionId)?.activities.find((item) => item.id === activityId);
    if (!activity) return;
    Object.assign(activity, patch);
    void this.save();
    this.refreshWeeklyActual();
  }

  removeActivity(sessionId: string, activityId: string) {
    const session = this.sessions.find((item) => item.id === sessionId);
    if (!session) return;
    session.activities = session.activities.filter((item) => item.id !== activityId);
    void this.save(true);
    this.refreshWeeklyActual();
  }

  moveActivity(sessionId: string, activityId: string, direction: "up" | "down") {
    const session = this.sessions.find((item) => item.id === sessionId);
    if (!session) return false;
    const next = movedByDirection(session.activities, activityId, direction);
    if (!next) return false;
    session.activities = next;
    this.sessions = [...this.sessions];
    void this.save(true);
    this.refreshWeeklyActual();
    return true;
  }

  updateNotes(value: string) {
    this.notesRaw = value;
    void this.save();
  }

  async flushSave() {
    return documentSucceeded(await this.persistence.flush());
  }

  async unload() {
    return documentSucceeded(await this.persistence.close());
  }

  async checkExternalChanges() {
    return Boolean((await this.persistence.checkExternal()).applied);
  }

  async resolveConflict(choice: ConflictChoice) {
    return documentSucceeded(await this.persistence.resolveConflict(choice));
  }

}

export const dailyStore = new DailyStore();
