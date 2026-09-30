// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodoStore } from "$lib/features/todo/todoStore.svelte.js";
import { DailyStore } from "$lib/features/daily/dailyStore.svelte.js";
import { WeekStore } from "$lib/features/weekly/weekStore.svelte.js";
import { ScratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.js";
import { DocumentController } from "./documentController.js";

const cases = [
  { name: "Todo", Store: TodoStore, initial: "- [ ] initial\n", open: (s) => s.loadFile({ path: "document.md" }), edit: (s, text) => s.updateText(s.todos[0].id, text), text: (s) => s.todos[0].text, external: "- [ ] external\n" },
  { name: "Day", Store: DailyStore, initial: "# 2026-09-28\n\n## Notes\n\ninitial\n", open: (s) => s.loadPath("document.md", "2026-09-28"), edit: (s, text) => s.updateNotes(text), text: (s) => s.notesRaw.trim(), external: "# 2026-09-28\n\n## Notes\n\nexternal\n" },
  { name: "Week", Store: WeekStore, initial: "# Week\n\n## Notes\n\ninitial\n", open: (s) => s.loadPath("document.md", { year: 2026, week: 40, rangeLabel: "September 28 - October 4" }), edit: (s, text) => s.updateNotes(text), text: (s) => s.notesRaw.trim(), external: "# Week\n\n## Notes\n\nexternal\n" },
  { name: "Scratchpad", Store: ScratchpadStore, initial: "initial", open: (s) => s.loadPath("document.md"), edit: (s, text) => s.updateContent(text), text: (s) => s.content, external: "external" }
];

async function harness(c) {
  let disk = c.initial;
  const fileService = {
    pathExists: vi.fn(async () => true),
    readFile: vi.fn(async () => disk),
    writeFile: vi.fn(async (_path, content) => { disk = content; })
  };
  const store = new c.Store({ fileService, registry: { register() {} }, appStore: { filePath: "document.md", showStatus: vi.fn() }, weekStore: { refreshActualWithDaily() {} } });
  await c.open(store);
  await store.flushSave();
  return { store, fileService, disk: () => disk, external: () => { disk = c.external; } };
}

describe.each(cases)("$name shared lifecycle contract", (c) => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("saves its latest visible data through DocumentController", async () => {
    const { store, disk } = await harness(c);
    expect(store.persistence).toBeInstanceOf(DocumentController);
    c.edit(store, "latest");
    expect(await store.flushSave()).toBe(true);
    expect(disk()).toContain("latest");
    expect(store.dirty).toBe(false);
  });

  it("applies external content automatically when clean", async () => {
    const { store, external } = await harness(c);
    external();
    expect(await store.checkExternalChanges()).toBe(true);
    expect(c.text(store)).toBe("external");
    expect(store.conflict).toBeNull();
    expect(store.dirty).toBe(false);
  });

  it("keeps current local data through conflict, focus and Keep Local", async () => {
    const { store, external, disk } = await harness(c);
    c.edit(store, "older local");
    external();
    expect(await store.flushSave()).toBe(false);
    c.edit(store, "latest local");
    expect(await c.open(store)).toBe(true);
    expect(c.text(store)).toBe("latest local");
    expect(store.conflict.localContent).toContain("latest local");
    expect(await store.resolveConflict("keep-local")).toBe(true);
    expect(disk()).toContain("latest local");
    expect(store.conflict).toBeNull();
  });

  it.each(["readFile", "writeFile"])("blocks close on %s failure and saves the retained data on retry", async (operation) => {
    const { store, fileService, disk } = await harness(c);
    const original = fileService[operation].getMockImplementation();
    c.edit(store, "unsaved");
    fileService[operation].mockRejectedValue(new Error("locked"));
    expect(await store.unload()).toBe(false);
    expect(store.persistence.loaded).toBe(true);
    expect(c.text(store)).toBe("unsaved");
    expect(store.dirty).toBe(true);
    fileService[operation].mockImplementation(original);
    expect(await store.flushSave()).toBe(true);
    expect(disk()).toContain("unsaved");
    expect(await store.unload()).toBe(true);
    expect(store.persistence.loaded).toBe(false);
  });
});
