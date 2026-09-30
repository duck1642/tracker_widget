// @ts-nocheck
import * as defaultFileService from "$lib/shared/services/fileService.js";
import { DocumentController, documentSucceeded } from "$lib/shared/persistence/documentController.js";
import { appStore as defaultAppStore } from "$lib/app/appStore.svelte.js";
import { persistenceRegistry as defaultRegistry } from "$lib/app/persistenceRegistry.js";

export class ScratchpadStore {
  view = "scratchpad";
  path = $state("");
  content = $state("");
  loaded = $state(false);
  fileMissing = $state(false);
  dirty = $state(false);
  saving = $state(false);
  conflict = $state(null);
  loading = $state(false);
  error = $state(null);

  constructor({
    fileService = defaultFileService,
    appStore = defaultAppStore,
    registry = defaultRegistry,
    debounceMs = 250
  } = {}) {
    this.fileService = fileService;
    this.appStore = appStore;
    this.persistence = new DocumentController({
      fileService,
      debounceMs,
      loadLabel: "Scratchpad",
      missingMode: "placeholder",
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

  async loadPath(path, { isCurrent } = {}) {
    const result = await this.persistence.open(path, { isCurrent });
    return documentSucceeded(result) || (result.status === "missing" && !this.loaded);
  }

  updateContent(content) {
    this.content = content;
    this.persistence.setDraft(content);
  }

  async flushSave() {
    return documentSucceeded(await this.persistence.flush());
  }

  async checkExternalChanges() {
    return Boolean((await this.persistence.checkExternal()).applied);
  }

  async resolveConflict(choice) {
    return documentSucceeded(await this.persistence.resolveConflict(choice));
  }

  async unload() {
    return documentSucceeded(await this.persistence.close());
  }

}

export const scratchpadStore = new ScratchpadStore();
