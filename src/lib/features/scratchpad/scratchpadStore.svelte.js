// @ts-nocheck
import * as defaultFileService from "$lib/shared/services/fileService.js";
import { PersistenceCoordinator } from "$lib/shared/persistence/persistenceCoordinator.js";
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

  constructor({
    fileService = defaultFileService,
    appStore = defaultAppStore,
    registry = defaultRegistry,
    debounceMs = 250
  } = {}) {
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

  async loadPath(path) {
    if (!path) return false;
    if (this.loaded && this.path === path) return true;
    if (this.loaded && !(await this.flushSave())) return false;

    try {
      const exists = await this.fileService.pathExists(path);
      if (!exists) {
        this.path = path;
        this.content = "";
        this.loaded = false;
        this.fileMissing = true;
        this.persistence.reset("", "");
        return true;
      }
      const content = await this.fileService.readFile(path);
      this.path = path;
      this.content = content;
      this.loaded = true;
      this.fileMissing = false;
      this.persistence.reset(path, content);
      return true;
    } catch (error) {
      this.loaded = false;
      this.fileMissing = false;
      this.appStore.showStatus("Scratchpad load failed: " + error);
      return false;
    }
  }

  updateContent(content) {
    this.content = content;
    void this.persistence.schedule(content);
  }

  flushSave() {
    return this.persistence.flush();
  }

  async checkExternalChanges() {
    if (!this.loaded) return false;
    try {
      const content = await this.persistence.checkExternal();
      if (typeof content === "string") {
        this.content = content;
        this.persistence.reset(this.path, content);
      }
      return Boolean(content);
    } catch (error) {
      this.appStore.showStatus("Scratchpad check failed: " + error);
      return false;
    }
  }

  async resolveConflict(choice) {
    const content = await this.persistence.resolve(choice);
    if (choice === "reload" && typeof content === "string") this.content = content;
    return typeof content === "string";
  }

  unload() {
    this.path = "";
    this.content = "";
    this.loaded = false;
    this.fileMissing = false;
    this.persistence.reset("", "");
  }
}

export const scratchpadStore = new ScratchpadStore();
