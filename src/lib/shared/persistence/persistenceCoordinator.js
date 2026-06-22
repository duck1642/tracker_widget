// @ts-nocheck
export class PersistenceCoordinator {
  constructor({ fileService, debounceMs = 250, onState = () => {}, onStatus = () => {} }) {
    this.fileService = fileService;
    this.debounceMs = debounceMs;
    this.onState = onState;
    this.onStatus = onStatus;
    this.path = "";
    this.baseContent = "";
    this.pending = null;
    this.timer = null;
    this.writing = null;
    this.conflict = null;
  }

  state() {
    return { dirty: Boolean(this.pending) || Boolean(this.conflict), saving: Boolean(this.writing), conflict: this.conflict };
  }

  emit() {
    this.onState(this.state());
  }

  reset(path, content) {
    this.cancel();
    this.path = path;
    this.baseContent = content;
    this.conflict = null;
    this.emit();
  }

  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  schedule(content, immediate = false) {
    if (content === this.baseContent && !this.writing) {
      this.cancel();
      this.emit();
      return Promise.resolve(true);
    }
    if (this.conflict) {
      this.conflict = { ...this.conflict, localContent: content };
      this.emit();
      return Promise.resolve(false);
    }
    this.pending = { path: this.path, content };
    if (this.timer) clearTimeout(this.timer);
    if (immediate) return this.start();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.start();
    }, this.debounceMs);
    this.emit();
    return Promise.resolve(true);
  }

  start() {
    if (!this.writing) {
      this.writing = this.run().finally(() => {
        this.writing = null;
        this.emit();
      });
      this.emit();
    }
    return this.writing;
  }

  async run() {
    while (this.pending && !this.conflict) {
      const write = this.pending;
      this.pending = null;
      const diskContent = await this.fileService.readFile(write.path);
      if (diskContent !== this.baseContent) {
        this.pending = write;
        this.conflict = { path: write.path, diskContent, localContent: write.content };
        this.onStatus("External change detected");
        this.emit();
        return false;
      }
      try {
        await this.fileService.writeFile(write.path, write.content);
        this.baseContent = write.content;
      } catch (error) {
        this.pending ||= write;
        this.onStatus("Save failed: " + error);
        this.emit();
        return false;
      }
    }
    this.emit();
    return !this.pending && !this.conflict;
  }

  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.conflict) return false;
    if (this.pending) await this.start();
    if (this.writing) await this.writing;
    if (this.pending && !this.conflict) await this.start();
    return !this.pending && !this.conflict;
  }

  async checkExternal() {
    if (!this.path || this.conflict) return false;
    if (this.writing) await this.writing;
    const diskContent = await this.fileService.readFile(this.path);
    if (diskContent === this.baseContent) return false;
    if (this.pending) {
      this.conflict = { path: this.path, diskContent, localContent: this.pending.content };
      this.emit();
      return false;
    }
    return diskContent;
  }

  async resolve(choice) {
    if (!this.conflict) return null;
    const conflict = this.conflict;
    if (choice === "reload") {
      this.cancel();
      this.baseContent = conflict.diskContent;
      this.conflict = null;
      this.emit();
      return conflict.diskContent;
    }
    this.baseContent = conflict.diskContent;
    this.conflict = null;
    this.pending = { path: conflict.path, content: conflict.localContent };
    await this.flush();
    return conflict.localContent;
  }
}
