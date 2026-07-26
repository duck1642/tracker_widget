// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { ScratchpadStore } from "./scratchpadStore.svelte.js";

function harness(initialFiles = {}) {
  const files = new Map(Object.entries(initialFiles));
  const fileService = {
    pathExists: vi.fn(async (path) => files.has(path)),
    readFile: vi.fn(async (path) => files.get(path)),
    writeFile: vi.fn(async (path, content) => files.set(path, content))
  };
  const appStore = { showStatus: vi.fn() };
  const registry = { register: vi.fn() };
  const store = new ScratchpadStore({
    fileService,
    appStore,
    registry,
    debounceMs: 1
  });
  return { store, files, fileService, appStore, registry };
}

describe("ScratchpadStore", () => {
  it("registers as scratchpad persistence and reports a missing file without creating it", async () => {
    const { store, fileService, registry } = harness();

    expect(registry.register).toHaveBeenCalledWith(store);
    expect(await store.loadPath("C:\\Tracker\\scratchpad.md")).toBe(true);

    expect(store.view).toBe("scratchpad");
    expect(store.loaded).toBe(false);
    expect(store.fileMissing).toBe(true);
    expect(store.content).toBe("");
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  it("loads and autosaves standalone Markdown without transforming it", async () => {
    const markdown = "# Inbox\n\n- [ ] capture\n\n```js\nconst value = 1;\n```\n";
    const { store, files } = harness({ "scratchpad.md": markdown });
    await store.loadPath("scratchpad.md");

    expect(store.content).toBe(markdown);
    expect(store.fileMissing).toBe(false);

    const updated = `${markdown}\n## Later\n\nRaw text`;
    store.updateContent(updated);
    await store.flushSave();

    expect(files.get("scratchpad.md")).toBe(updated);
  });

  it("applies clean external edits and supports conflict reload", async () => {
    const { store, files } = harness({ "scratchpad.md": "initial" });
    await store.loadPath("scratchpad.md");

    files.set("scratchpad.md", "external clean");
    expect(await store.checkExternalChanges()).toBe(true);
    expect(store.content).toBe("external clean");

    store.updateContent("local pending");
    files.set("scratchpad.md", "external conflict");
    expect(await store.flushSave()).toBe(false);
    expect(store.conflict).toBeTruthy();

    await store.resolveConflict("reload");
    expect(store.content).toBe("external conflict");
    expect(store.conflict).toBeNull();
  });

  it("keeps local content when resolving an external conflict", async () => {
    const { store, files } = harness({ "scratchpad.md": "initial" });
    await store.loadPath("scratchpad.md");

    store.updateContent("local pending");
    files.set("scratchpad.md", "external conflict");
    expect(await store.flushSave()).toBe(false);

    await store.resolveConflict("keep-local");

    expect(files.get("scratchpad.md")).toBe("local pending");
    expect(store.content).toBe("local pending");
    expect(store.conflict).toBeNull();
  });

  it("flushes the loaded file before switching paths", async () => {
    const { store, files } = harness({
      "first.md": "first",
      "second.md": "second"
    });
    await store.loadPath("first.md");
    store.updateContent("first updated");

    expect(await store.loadPath("second.md")).toBe(true);
    expect(files.get("first.md")).toBe("first updated");
    expect(store.content).toBe("second");
  });

  it("keeps missing-file and load-failure states separate", async () => {
    const { store, fileService, appStore } = harness();
    fileService.pathExists.mockRejectedValueOnce(new Error("unavailable"));

    expect(await store.loadPath("scratchpad.md")).toBe(false);
    expect(store.loaded).toBe(false);
    expect(store.fileMissing).toBe(false);
    expect(appStore.showStatus).toHaveBeenCalledWith(
      expect.stringContaining("Scratchpad load failed")
    );
  });
});
