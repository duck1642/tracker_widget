// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { WeekStore } from "./weekStore.svelte.js";

const index = `# 2026 - Week 26 - June 22–28\n\n## Objectives\n\n- {subjects: (rust), origin: planned, status: open} Ship.\n\n## Weekly Plan\n\n| Day | Session | Subjects | Target Minutes |\n| --- | --- | --- | ---: |\n\n## Weekly Actual\n\n<!-- tracker:actual:start -->\n| Day | Session | Subjects | Actual Minutes |\n| --- | --- | --- | ---: |\n<!-- tracker:actual:end -->\n\n## Notes\n`;

function harness() {
  const files = new Map([["week.md", index]]);
  const fileService = {
    readFile: vi.fn(async (path) => files.get(path)),
    writeFile: vi.fn(async (path, content) => files.set(path, content))
  };
  const store = new WeekStore({
    fileService,
    appStore: { showStatus: vi.fn() },
    registry: { register: vi.fn() },
    debounceMs: 1
  });
  return { store, files };
}

describe("WeekStore editing", () => {
  it("persists objective state changes", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22–28" });
    store.updateObjective(store.objectives[0].id, { origin: "unplanned", status: "partial" });
    await store.flushSave();
    expect(files.get("week.md")).toContain("origin: unplanned, status: partial");
  });

  it("accepts an edit after a clean external reload without a false conflict", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22–28" });
    files.set("week.md", index.replace("## Notes", "## Reference\n\nexternal\n\n## Notes"));
    await store.checkExternalChanges();
    store.updateNotes("local after reload");
    await store.flushSave();
    expect(store.conflict).toBeNull();
    expect(files.get("week.md")).toContain("local after reload");
  });

  it("adds weekly plan entries with zero target minutes by default", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.addPlanEntry("Tue");
    await store.flushSave();
    expect(store.plan[0]).toMatchObject({ day: "Tue", session: "Session", subjects: ["general"], targetMinutes: 0 });
    expect(files.get("week.md")).toContain("| Tue | Session | general | 0 |");
  });

  it("adds multiple objectives with default metadata", async () => {
    const { store } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    expect(store.addObjectives(["One", "Two"])).toBe(true);
    expect(store.objectives.slice(-2)).toMatchObject([
      { subjects: ["general"], origin: "planned", status: "open", description: "One" },
      { subjects: ["general"], origin: "planned", status: "open", description: "Two" }
    ]);
  });

  it("does not add objectives from empty descriptions", async () => {
    const { store } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    expect(store.addObjectives([" ", ""])).toBe(false);
    expect(store.objectives).toHaveLength(1);
  });
});
