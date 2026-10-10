export type DocumentStatus = "ok" | "unchanged" | "superseded" | "conflict" | "error" | "missing";
export type DocumentResult = { status: DocumentStatus, applied?: boolean };
export type DocumentMeta<Context = undefined> = {
    path: string;
    context: Context | undefined;
    reason: "open" | "external" | "reload" | "transfer";
};
export type DocumentError = { operation: string, message: string };
export type DocumentConflict = {
    path: string;
    diskContent: string;
    localContent: string;
};
export type DocumentState = {
    path: string;
    loaded: boolean;
    loading: boolean;
    missing: boolean;
    dirty: boolean;
    saving: boolean;
    conflict: DocumentConflict | null;
    error: DocumentError | null;
};
export type FileService = {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    pathExists?: (path: string) => Promise<boolean>;
};
export type ConflictChoice = "reload" | "keep-local";
export interface CurrentRequest { isCurrent?: () => boolean }
export interface DocumentOptions<Prepared, Context = undefined> {
  fileService: FileService;
  debounceMs?: number;
  loadLabel?: string;
  missingMode?: "error" | "placeholder";
  prepare: (content: string, meta: DocumentMeta<Context>) => Prepared;
  apply?: (prepared: Prepared, meta: DocumentMeta<Context>) => void;
  clear?: () => void;
  afterApply?: (meta: DocumentMeta<Context>) => void;
  onState?: (state: DocumentState) => void;
  onStatus?: (message: string) => void;
}
export interface DocumentLifecycle {
  readonly path: string;
  state(): DocumentState;
  flush(): Promise<DocumentResult>;
  cancelOpen(): void;
}
// Only this module can release ownership after the complete group has drained.
const lifecycleAccess = Symbol("document lifecycle");
export interface ClosableController extends DocumentLifecycle {
  readonly [lifecycleAccess]: { request(): number; release(): void };
}


export function documentSucceeded(result: DocumentResult) {
  return result.status === "ok" || result.status === "unchanged";
}

/**
 * Owns one loaded document's serialized content and all of its file operations.
 * Adapters prepare without mutation, then apply synchronously at a validated commit.
 */
export class DocumentController<Prepared = string, Context = undefined> implements ClosableController {
  #path = "";
  #loaded = false;
  #loading = false;
  #missing = false;
  #base = "";
  #draft = "";
  #generation = 0;
  #revision = 0;
  #openRequest = 0;

  #context: Context | undefined;

  #conflictDisk: string | null = null;

  #error: DocumentError | null = null;

  #timer: ReturnType<typeof setTimeout> | null = null;

  #writing: Promise<DocumentResult> | null = null;

  #options: DocumentOptions<Prepared, Context>;
  readonly [lifecycleAccess] = { request: () => this.#openRequest, release: () => this.#release() };


  constructor(options: DocumentOptions<Prepared, Context>) {
    this.#options = options;
  }

  get path() { return this.#path; }
  get loaded() { return this.#loaded; }
  get baseContent() { return this.#base; }
  get generation() { return this.#generation; }


  state(): DocumentState {
    return {
      path: this.#path, loaded: this.#loaded, loading: this.#loading, missing: this.#missing,
      dirty: this.#loaded && (this.#draft !== this.#base || this.#writing !== null || this.#conflictDisk !== null),
      saving: this.#writing !== null,
      conflict: this.#conflictDisk === null ? null : { path: this.#path, diskContent: this.#conflictDisk, localContent: this.#draft },
      error: this.#error
    };
  }

  #emit() { this.#options.onState?.(this.state()); }

  #cancelTimer() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }


  #fail(operation: string, error: unknown): DocumentResult {
    this.#error = { operation, message: String(error) };
    const label = operation === "save" ? "Save" : `${this.#options.loadLabel || "Document"} ${operation}`;
    this.#options.onStatus?.(`${label} failed: ${error}`);
    this.#emit();
    return { status: "error" };
  }


  #prepare(content: string, meta: DocumentMeta<Context>) {
    return this.#options.prepare(content, meta);
  }


  #commit(content: string, prepared: Prepared, meta: DocumentMeta<Context>) {
    this.#cancelTimer();
    this.#path = meta.path;
    this.#context = meta.context;
    this.#base = content;
    this.#draft = content;
    this.#loaded = true;
    this.#missing = false;
    this.#conflictDisk = null;
    this.#error = null;
    this.#generation++;
    this.#revision++;
    this.#options.apply?.(prepared, meta);
    this.#emit();
  }


  #afterApply(meta: DocumentMeta<Context>) { this.#options.afterApply?.(meta); }

  #release() {
    this.cancelOpen();
    this.#cancelTimer();
    this.#path = "";
    this.#context = undefined;
    this.#base = this.#draft = "";
    this.#loaded = this.#missing = false;
    this.#conflictDisk = null;
    this.#error = null;
    this.#generation++;
    this.#revision++;
    this.#options.clear?.();
    this.#emit();
  }

  cancelOpen() {
    this.#openRequest++;
    this.#revision++;
    this.#loading = false;
    this.#emit();
  }


  async open(path: string, { context, isCurrent = () => true }: CurrentRequest & { context?: Context } = {}): Promise<DocumentResult> {
    if (!isCurrent()) return { status: "superseded" };
    const request = ++this.#openRequest;
    this.#revision++;
    const current = () => request === this.#openRequest && isCurrent();
    this.#loading = true;
    this.#emit();
    try {
      if (!path) {
        if (!this.#loaded) { this.#missing = true; this.#emit(); }
        return { status: "missing" };
      }
      if (this.#loaded && this.#path === path) {
        const checked = await this.checkExternal(current);
        if (!current()) return { status: "superseded" };
        // An already loaded conflicted/erroring document must remain accessible.
        return checked.applied ? checked : { status: "unchanged" };
      }
      const flushed = await this.flush();
      if (!current()) return { status: "superseded" };
      if (!documentSucceeded(flushed)) return flushed;
      const exists = this.#options.fileService.pathExists
        ? await this.#options.fileService.pathExists(path) : true;
      if (!current()) return { status: "superseded" };
      if (!exists) {
        if (!this.#loaded && this.#options.missingMode === "placeholder") {
          this.#path = path;
          this.#context = context;
          this.#missing = true;
          this.#error = null;
          this.#generation++;
          this.#options.clear?.();
          this.#emit();
        } else {
          if (!this.#loaded) { this.#missing = true; this.#emit(); }
          this.#options.onStatus?.(`${this.#options.loadLabel || "Document"} file not found`);
        }
        return { status: "missing" };
      }
      const content = await this.#options.fileService.readFile(path);
      if (!current()) return { status: "superseded" };
      if (typeof content !== "string") throw new Error("File read returned no text");
      const meta: DocumentMeta<Context> = { path, context, reason: "open" };
      const prepared = this.#prepare(content, meta);
      // Edits stay enabled while reading; drain them again before replacing the UI.
      do {
        const result = await this.flush();
        if (!current()) return { status: "superseded" };
        if (!documentSucceeded(result)) return result;
      } while (this.state().dirty || this.state().saving);
      this.#commit(content, prepared, meta);
      this.#afterApply(meta);
      return { status: "ok", applied: true };
    } catch (error) {
      return current() ? this.#fail("load", error) : { status: "superseded" };
    } finally {
      if (request === this.#openRequest) {
        this.#loading = false;
        this.#emit();
      }
    }
  }


  setDraft(content: string) {
    if (!this.#loaded) return;
    this.#draft = content;
    this.#revision++;
    this.#cancelTimer();
    if (this.#conflictDisk === null && this.#draft !== this.#base) {
      this.#timer = setTimeout(() => {
        this.#timer = null;
        void this.flush();
      }, this.#options.debounceMs ?? 250);
    }
    this.#emit();
  }


  async flush(): Promise<DocumentResult> {
    this.#cancelTimer();
    if (this.#conflictDisk !== null) return { status: "conflict" };
    if (!this.#loaded) return { status: "unchanged" };
    if (this.#writing) {
      const result = await this.#writing;
      if (!documentSucceeded(result)) return result;
      // A caller may have edited again in the writer's completion continuation.
      return this.#draft !== this.#base ? this.flush() : result;
    }
    if (this.#draft === this.#base) return { status: "unchanged" };
    this.#revision++;
    this.#writing = this.#runWrite().finally(() => {
      this.#writing = null;
      this.#emit();
    });
    this.#emit();
    const result = await this.#writing;
    if (!documentSucceeded(result)) return result;
    if (this.#conflictDisk !== null) return { status: "conflict" };
    return this.#draft !== this.#base ? this.flush() : result;
  }


  async #runWrite(): Promise<DocumentResult> {
    while (this.#draft !== this.#base && this.#conflictDisk === null) {
      const path = this.#path;
      const generation = this.#generation;
      const content = this.#draft;
      try {
        const disk = await this.#options.fileService.readFile(path);
        if (generation !== this.#generation) return { status: "superseded" };
        if (disk !== this.#base) {
          if (disk === this.#draft) {
            this.#base = disk;
            this.#error = null;
            this.#revision++;
            continue;
          }
          this.#conflictDisk = disk;
          this.#options.onStatus?.("External change detected");
          this.#emit();
          return { status: "conflict" };
        }
        await this.#options.fileService.writeFile(path, content);
        if (generation !== this.#generation) return { status: "superseded" };
        this.#base = content;
        this.#error = null;
        this.#revision++;
      } catch (error) {
        return this.#fail("save", error);
      }
    }
    return { status: "ok" };
  }


  async checkExternal(isCurrent: () => boolean = () => true): Promise<DocumentResult> {
    if (!this.#loaded) return { status: "unchanged" };
    if (this.#conflictDisk !== null) return { status: "conflict" };
    const revision = this.#revision;
    const current = () => revision === this.#revision && isCurrent();
    try {
      if (this.#writing) await this.#writing;
      if (!current()) return { status: "superseded" };
      const disk = await this.#options.fileService.readFile(this.#path);
      if (!current()) return { status: "superseded" };
      if (disk === this.#base) return { status: "unchanged" };
      if (disk === this.#draft) {
        this.#base = disk;
        this.#error = null;
        this.#revision++;
        this.#cancelTimer();
        this.#emit();
        return { status: "ok" };
      }
      if (this.#draft !== this.#base) {
        this.#conflictDisk = disk;
        this.#cancelTimer();
        this.#emit();
        return { status: "conflict" };
      }
      const meta: DocumentMeta<Context> = { path: this.#path, context: this.#context, reason: "external" };
      const prepared = this.#prepare(disk, meta);
      this.#commit(disk, prepared, meta);
      this.#afterApply(meta);
      return { status: "ok", applied: true };
    } catch (error) {
      return current() ? this.#fail("check", error) : { status: "superseded" };
    }
  }


  async resolveConflict(choice: "reload" | "keep-local"): Promise<DocumentResult> {
    if (this.#conflictDisk === null) return { status: "unchanged" };
    this.cancelOpen();
    const revision = this.#revision;
    const generation = this.#generation;
    const request = this.#openRequest;
    const expectedDisk = this.#conflictDisk;
    const current = () => request === this.#openRequest && generation === this.#generation && (choice === "keep-local" || revision === this.#revision);
    try {
      const disk = await this.#options.fileService.readFile(this.#path);
      if (!current()) return { status: "superseded" };
      if (choice === "reload") {
        const meta: DocumentMeta<Context> = { path: this.#path, context: this.#context, reason: "reload" };
        const prepared = this.#prepare(disk, meta);
        this.#commit(disk, prepared, meta);
        this.#afterApply(meta);
        return { status: "ok", applied: true };
      }
      if (disk !== expectedDisk && disk !== this.#draft) {
        this.#conflictDisk = disk;
        this.#emit();
        return { status: "conflict" };
      }
      this.#base = disk;
      this.#conflictDisk = null;
      this.#error = null;
      this.#revision++;
      this.#emit();
      return await this.flush();
    } catch (error) {
      return current() ? this.#fail("resolve", error) : { status: "superseded" };
    }
  }


  close(): Promise<DocumentResult> { return DocumentController.closeAll([this]); }


  static async flushAll(documents: readonly DocumentLifecycle[], { isCurrent = () => true }: CurrentRequest = {}): Promise<DocumentResult> {
    if (!isCurrent()) return { status: "superseded" };
    const unique = [...new Set(documents)];
    do {
      const results = await Promise.all(unique.map((document) => document.flush()));
      if (!isCurrent()) return { status: "superseded" };
      const blocked = results.find((result) => !documentSucceeded(result));
      if (blocked) return blocked;
    } while (unique.some((document) => document.state().dirty || document.state().saving));
    return { status: "ok" };
  }


  static async closeAll(documents: readonly ClosableController[], { isCurrent = () => true, commit = () => {} }: CurrentRequest & { commit?: () => void } = {}): Promise<DocumentResult> {
    if (!isCurrent()) return { status: "superseded" };
    const unique = [...new Set(documents)];
    unique.forEach((document) => document.cancelOpen());
    const requests = unique.map((document) => document[lifecycleAccess].request());
    const current = () => isCurrent() && unique.every((document, index) => document[lifecycleAccess].request() === requests[index]);
    do {
      const result = await DocumentController.flushAll(unique, { isCurrent: current });
      if (!current()) return { status: "superseded" };
      if (!documentSucceeded(result)) return result;
    } while (unique.some((document) => document.state().dirty));
    unique.forEach((document) => document[lifecycleAccess].release());
    commit();
    return { status: "ok" };
  }


  async transferTo(target: DocumentController<Prepared, Context>, { context, isCurrent = () => true, commit = () => {} }: CurrentRequest & { context?: Context, commit?: () => void } = {}): Promise<DocumentResult> {
    if (!isCurrent()) return { status: "superseded" };
    if (!this.#loaded || target === this) return { status: "unchanged" };
    this.cancelOpen();
    target.cancelOpen();
    const sourceRequest = this.#openRequest;
    const targetRequest = target.#openRequest;
    const path = this.#path;
    const current = () => isCurrent() && this.#openRequest === sourceRequest && target.#openRequest === targetRequest;
    try {
      const meta: DocumentMeta<Context> = { path, context, reason: "transfer" };
      let content = this.#draft;
      let prepared = target.#prepare(content, meta);
      let checked;
      do {
        const result = await DocumentController.flushAll([this, target], { isCurrent: current });
        if (!current()) return { status: "superseded" };
        if (!documentSucceeded(result)) return result;
        checked = await this.checkExternal(current);
        if (!current()) return { status: "superseded" };
        if (checked.status === "error" || checked.status === "conflict") return checked;
        // External reload may legitimately advance generation; path ownership cannot.
        if (this.#path !== path) return { status: "superseded" };
      } while (checked.status === "superseded" || this.state().dirty || target.state().dirty || target.state().saving);
      if (content !== this.#base) {
        content = this.#base;
        prepared = target.#prepare(content, meta);
      }
      if (!current()) return { status: "superseded" };
      this.#release();
      target.#commit(content, prepared, meta);
      commit();
      target.#afterApply(meta);
      return { status: "ok", applied: true };
    } catch (error) {
      return current() ? target.#fail("load", error) : { status: "superseded" };
    }
  }
}
