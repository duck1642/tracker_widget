// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { DailyStore } from "./dailyStore.svelte.js";

function harness(initial, overrides = {}) {
  const files = new Map([["day.md", initial]]);
  const fileService = {
    readFile: vi.fn(async (path) => files.get(path)),
    writeFile: vi.fn(async (path, content) => files.set(path, content))
  };
  const storeOptions = {
    fileService,
    appStore: { showStatus: vi.fn() },
    registry: { register: vi.fn() },
    debounceMs: 1
  };
  if ("weekStore" in overrides) storeOptions.weekStore = overrides.weekStore;
  if ("sessionHistoryStore" in overrides) storeOptions.sessionHistoryStore = overrides.sessionHistoryStore;
  const store = new DailyStore(storeOptions);
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

  it("records successful added sessions in session history", async () => {
    const sessionHistoryStore = { record: vi.fn(async () => true) };
    const { store } = harness("# 2026-06-22\n\n## Total Time\n\n0m\n\n## Notes\n", { sessionHistoryStore });
    await store.loadPath("day.md", "2026-06-22");

    expect(store.addSession("Reading")).toBe(true);
    expect(store.addSession("reading")).toBe(false);

    expect(sessionHistoryStore.record).toHaveBeenCalledOnce();
    expect(sessionHistoryStore.record).toHaveBeenCalledWith(["Reading"]);
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

  it("renames a session correctly and preserves uniqueness without recording empty sessions", async () => {
    const sessionHistoryStore = { record: vi.fn(async () => true) };
    const { store, files } = harness("# 2026-06-22\n\n## Work\n\n## Play\n\n## Total Time\n\n0m\n\n## Notes\n", { sessionHistoryStore });
    await store.loadPath("day.md", "2026-06-22");
    const workId = store.sessions[0].id;
    
    // Cannot rename to an existing session (case-insensitive check)
    expect(store.renameSession(workId, "play")).toBe(false);
    expect(sessionHistoryStore.record).not.toHaveBeenCalled();
    
    // Can rename to a valid new name
    expect(store.renameSession(workId, "Coding")).toBe(true);
    await store.flushSave();
    
    expect(store.sessions[0].name).toBe("Coding");
    expect(files.get("day.md")).toContain("## Coding");
    expect(files.get("day.md")).not.toContain("## Work");
    expect(sessionHistoryStore.record).not.toHaveBeenCalled();
  });

  it("records renamed sessions in history when they have activities", async () => {
    const sessionHistoryStore = { record: vi.fn(async () => true) };
    const { store } = harness("# 2026-06-22\n\n## Work\n\n- {subjects: (rust), time: 10m} Code\n\n## Total Time\n\n10m\n\n## Notes\n", { sessionHistoryStore });
    await store.loadPath("day.md", "2026-06-22");

    expect(store.renameSession(store.sessions[0].id, "Coding")).toBe(true);

    expect(sessionHistoryStore.record).toHaveBeenCalledOnce();
    expect(sessionHistoryStore.record).toHaveBeenCalledWith(["Coding"]);
  });

  it("adds new activities with zero minutes by default", async () => {
    const { store } = harness("# 2026-06-22\n\n## Work\n\n## Total Time\n\n0m\n\n## Notes\n");
    await store.loadPath("day.md", "2026-06-22");
    store.addActivity(store.sessions[0].id);
    expect(store.sessions[0].activities[0]).toMatchObject({ subjects: ["general"], minutes: 0, description: "" });
  });

  it("adds multiple activities with default metadata", async () => {
    const { store } = harness("# 2026-06-22\n\n## Work\n\n## Total Time\n\n0m\n\n## Notes\n");
    await store.loadPath("day.md", "2026-06-22");
    const originalSessions = store.sessions;
    const originalActivities = store.sessions[0].activities;
    expect(store.addActivities(store.sessions[0].id, ["One", "Two"])).toBe(true);
    expect(store.sessions).not.toBe(originalSessions);
    expect(store.sessions[0].activities).not.toBe(originalActivities);
    expect(store.sessions[0].activities).toHaveLength(2);
    expect(store.sessions[0].activities[0]).toMatchObject({ subjects: ["general"], minutes: 0, description: "One" });
    expect(store.sessions[0].activities[1]).toMatchObject({ subjects: ["general"], minutes: 0, description: "Two" });
    await store.flushSave();
    await store.loadPath("day.md", "2026-06-22");
    expect(store.sessions[0].activities.map((activity) => activity.description)).toEqual(["One", "Two"]);
  });

  it("does not add activities for missing sessions or empty descriptions", async () => {
    const { store } = harness("# 2026-06-22\n\n## Work\n\n## Total Time\n\n0m\n\n## Notes\n");
    await store.loadPath("day.md", "2026-06-22");
    expect(store.addActivities("missing", ["One"])).toBe(false);
    expect(store.addActivities(store.sessions[0].id, [" ", ""])).toBe(false);
    expect(store.sessions[0].activities).toHaveLength(0);
  });

  it("moves activities within a session and persists the order", async () => {
    const { store, files } = harness("# 2026-06-22\n\n## Work\n\n- {subjects: (rust), time: 10m} One\n- {subjects: (rust), time: 20m} Two\n\n## Total Time\n\n30m\n\n## Notes\n");
    await store.loadPath("day.md", "2026-06-22");
    const [one, two] = store.sessions[0].activities;
    expect(store.moveActivity(store.sessions[0].id, one.id, "down")).toBe(true);
    expect(store.sessions[0].activities.map((activity) => activity.description)).toEqual(["Two", "One"]);
    expect(store.moveActivity(store.sessions[0].id, two.id, "up")).toBe(false);
    await store.flushSave();
    expect(files.get("day.md").indexOf("Two")).toBeLessThan(files.get("day.md").indexOf("One"));
  });

  it("moves sessions before or after another session", async () => {
    const { store, files } = harness("# 2026-06-22\n\n## Alpha\n\n## Beta\n\n## Gamma\n\n## Total Time\n\n0m\n\n## Notes\n");
    await store.loadPath("day.md", "2026-06-22");
    const [alpha, beta, gamma] = store.sessions;
    expect(store.moveSessionTo(gamma.id, alpha.id, "before")).toBe(true);
    expect(store.sessions.map((session) => session.name)).toEqual(["Gamma", "Alpha", "Beta"]);
    expect(store.moveSessionTo(gamma.id, alpha.id, "before")).toBe(false);
    expect(store.moveSessionTo("missing", beta.id, "after")).toBe(false);
    expect(store.moveSessionTo(beta.id, beta.id, "after")).toBe(false);
    await store.flushSave();
    expect(files.get("day.md").indexOf("## Gamma")).toBeLessThan(files.get("day.md").indexOf("## Alpha"));
  });

  it("refreshes loaded weekly actual after daily mutations", async () => {
    const weekStore = { loaded: true, refreshActualWithDaily: vi.fn() };
    const { store } = harness("# 2026-06-22\n\n## Work\n\n- {subjects: (rust), time: 10m} One\n- {subjects: (rust), time: 20m} Two\n\n## Total Time\n\n30m\n\n## Notes\n", { weekStore });
    await store.loadPath("day.md", "2026-06-22");
    const [one] = store.sessions[0].activities;

    store.updateActivity(store.sessions[0].id, one.id, { minutes: 15 });

    expect(weekStore.refreshActualWithDaily).toHaveBeenCalledWith("2026-06-22", store.sessions);
  });
});
