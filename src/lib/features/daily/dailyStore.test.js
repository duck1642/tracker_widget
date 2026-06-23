// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { DailyStore } from "./dailyStore.svelte.js";

function harness(initial) {
  const files = new Map([["day.md", initial]]);
  const fileService = {
    readFile: vi.fn(async (path) => files.get(path)),
    writeFile: vi.fn(async (path, content) => files.set(path, content))
  };
  const store = new DailyStore({
    fileService,
    appStore: { showStatus: vi.fn() },
    registry: { register: vi.fn() },
    debounceMs: 1
  });
  return { store, files };
}

describe("DailyStore editing", () => {
  it("enforces normalized case-insensitive session uniqueness", async () => {
    const { store } = harness("# 2026-06-22\n\n## İş\n\n## Total Time\n\n0m\n\n## Notes\n");
    await store.loadPath("day.md", "2026-06-22");
    expect(store.addSession("İŞ")).toBe(false);
    expect(store.addSession("Reading")).toBe(true);
    await store.flushSave();
    expect(store.sessions.map((session) => session.name)).toEqual(["İş", "Reading"]);
  });

  it("accepts an edit after a clean external reload without a false conflict", async () => {
    const { store, files } = harness("# 2026-06-22\n\n## Total Time\n\n0m\n\n## Notes\n\nold\n");
    await store.loadPath("day.md", "2026-06-22");
    files.set("day.md", "# 2026-06-22\n\n## Total Time\n\n0m\n\n## Notes\n\nexternal\n");
    await store.checkExternalChanges();
    store.updateNotes("local after reload");
    await store.flushSave();
    expect(store.conflict).toBeNull();
    expect(files.get("day.md")).toContain("local after reload");
  });

  it("deletes a session and persists its removal", async () => {
    const { store, files } = harness("# 2026-06-22\n\n## Work\n\n- {subjects: (rust), time: 30m} Code.\n\n## Total Time\n\n30m\n\n## Notes\n");
    await store.loadPath("day.md", "2026-06-22");
    store.removeSession(store.sessions[0].id);
    await store.flushSave();
    expect(store.sessions).toHaveLength(0);
    expect(files.get("day.md")).not.toContain("## Work");
  });

  it("renames a session correctly and preserves uniqueness", async () => {
    const { store, files } = harness("# 2026-06-22\n\n## Work\n\n## Play\n\n## Total Time\n\n0m\n\n## Notes\n");
    await store.loadPath("day.md", "2026-06-22");
    const workId = store.sessions[0].id;
    const playId = store.sessions[1].id;
    
    // Cannot rename to an existing session (case-insensitive check)
    expect(store.renameSession(workId, "play")).toBe(false);
    
    // Can rename to a valid new name
    expect(store.renameSession(workId, "Coding")).toBe(true);
    await store.flushSave();
    
    expect(store.sessions[0].name).toBe("Coding");
    expect(files.get("day.md")).toContain("## Coding");
    expect(files.get("day.md")).not.toContain("## Work");
  });
});
