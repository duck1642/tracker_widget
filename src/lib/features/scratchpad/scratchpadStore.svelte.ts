import * as defaultFileService from "$lib/shared/services/fileService.ts";
import { DocumentController, documentSucceeded } from "$lib/shared/persistence/documentController.ts";
import { appStore as defaultAppStore } from "$lib/app/appStore.svelte.ts";
import { persistenceRegistry as defaultRegistry } from "$lib/app/persistenceRegistry.ts";
import type { ConflictChoice, CurrentRequest, DocumentConflict, DocumentError, FileService } from "$lib/shared/persistence/documentController.ts";
import type { StatusSink } from "$lib/shared/services/types.ts";
import type { RegistrySink } from "$lib/app/persistenceRegistry.ts";

interface ScratchpadOptions {

    fileService?: FileService;

    appStore?: StatusSink;

    registry?: RegistrySink;

    debounceMs?: number;

}

export class ScratchpadStore {
  fileService: FileService;
  appStore: StatusSink;
  persistence: DocumentController<string>;
  view = "scratchpad" as const;
  path = $state("");
  content = $state("");
  loaded = $state(false);
  fileMissing = $state(false);
  dirty = $state(false);
  saving = $state(false);
  conflict = $state<DocumentConflict | null>(null);
  loading = $state(false);
  error = $state<DocumentError | null>(null);

  constructor({
    fileService = defaultFileService,
    appStore = defaultAppStore,
    registry = defaultRegistry,
    debounceMs = 250
  }: ScratchpadOptions = {}) {
    this.fileService = fileService;
    this.appStore = appStore;
    this.persistence = new DocumentController({
      fileService,
      debounceMs,
      loadLabel: "Scratchpad",
      missingMode: "placeholder",
      prepare: (content) => content,
      apply: (content) => { this.content = content; },
      clear: () => { this.content = ""; },
      onState: (state) => {
        this.path = state.path;
        this.loaded = state.loaded;
        this.loading = state.loading;
        this.error = state.error;
        this.fileMissing = state.missing;
        this.dirty = state.dirty;
        this.saving = state.saving;
        this.conflict = state.conflict;
      },
      onStatus: (message) => this.appStore.showStatus(message)
    });
    registry.register(this);
  }

  async loadPath(path: string, { isCurrent }: CurrentRequest = {}) {
    const result = await this.persistence.open(path, { isCurrent });
    return documentSucceeded(result) || (result.status === "missing" && !this.loaded);
  }

  updateContent(content: string) {
    this.content = content;
    this.persistence.setDraft(content);
  }

  async flushSave() {
    return documentSucceeded(await this.persistence.flush());
  }

  async checkExternalChanges() {
    return Boolean((await this.persistence.checkExternal()).applied);
  }

  async resolveConflict(choice: ConflictChoice) {
    return documentSucceeded(await this.persistence.resolveConflict(choice));
  }

  async unload() {
    return documentSucceeded(await this.persistence.close());
  }

}

export const scratchpadStore = new ScratchpadStore();
