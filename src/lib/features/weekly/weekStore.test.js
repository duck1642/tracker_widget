// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { WeekStore } from "./weekStore.svelte.js";

const index = `# 2026 - Week 26 - June 22-28\n\n## Objectives\n\n- {subjects: (rust), origin: planned, status: open} Ship.\n\n## Weekly Plan\n\n| ID | Day | Session | Subjects | Target Minutes |\n| --- | --- | --- | --- | ---: |\n\n## Weekly Plan Details\n\n<!-- tracker:plan-details:start -->\n<!-- tracker:plan-details:end -->\n\n## Weekly Actual\n\n<!-- tracker:actual:start -->\n| Day | Session | Subjects | Actual Minutes |\n| --- | --- | --- | ---: |\n<!-- tracker:actual:end -->\n\n## Notes\n`;

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
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.updateObjective(store.objectives[0].id, { origin: "unplanned", status: "partial" });
    await store.flushSave();
    expect(files.get("week.md")).toContain("origin: unplanned, status: partial");
  });

  it("accepts an edit after a clean external reload without a false conflict", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
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
    expect(store.plan[0]).toMatchObject({
      id: "p1",
      day: "Tue",
      session: "Session",
      subjects: ["general"],
      targetMinutes: 0,
      activities: [{ subjects: ["general"], minutes: 0, description: "Session" }]
    });
    expect(files.get("week.md")).toContain("| p1 | Tue | Session | general | 0 |");
    expect(files.get("week.md")).toContain("### p1\n\n- {subjects: (general), time: 0m} Session");
  });

  it("uses the next highest plan ID when adding entries", async () => {
    const { store } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.plan = [
      { id: "p1", day: "Mon", session: "One", subjects: ["general"], targetMinutes: 0, activities: [] },
      { id: "p3", day: "Tue", session: "Three", subjects: ["general"], targetMinutes: 0, activities: [] }
    ];
    store.addPlanEntry("Mon");
    expect(store.plan.at(-1).id).toBe("p4");
  });

  it("returns sorted unique session suggestions from the whole week", () => {
    const { store } = harness();
    store.plan = [
      { day: "Mon", session: "  Zeta  " },
      { day: "Mon", session: "beta" },
      { day: "Mon", session: "Alpha" },
      { day: "Mon", session: "BETA" },
      { day: "Mon", session: " " },
      { day: "Tue", session: "Other day" }
    ];

    expect(store.suggestionsFor("Mon")).toEqual(["Alpha", "beta", "Other day", "Zeta"]);
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

  it("moves objectives and persists their order", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.addObjectives(["Second"]);
    const [first, second] = store.objectives;
    expect(store.moveObjective(first.id, "down")).toBe(true);
    expect(store.objectives.map((objective) => objective.description)).toEqual(["Second", "Ship."]);
    expect(store.moveObjective(second.id, "up")).toBe(false);
    expect(store.moveObjective("missing", "down")).toBe(false);
    await store.flushSave();
    expect(files.get("week.md").indexOf("Second")).toBeLessThan(files.get("week.md").indexOf("Ship."));
  });

  it("edits and reorders planned activities", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.addPlanEntry("Fri");
    const entry = store.plan[0];
    store.updatePlanActivity(entry.id, entry.activities[0].id, { description: "First", subjects: ["math"], minutes: 30 });
    store.addPlanActivity(entry.id);
    store.updatePlanActivity(entry.id, entry.activities[1].id, { description: "Second", subjects: ["rust"], minutes: 45 });

    expect(store.movePlanActivity(entry.id, entry.activities[1].id, "up")).toBe(true);
    expect(store.plan[0].activities.map((activity) => activity.description)).toEqual(["Second", "First"]);
    store.removePlanActivity(entry.id, store.plan[0].activities[1].id);
    await store.flushSave();

    expect(files.get("week.md")).toContain("### p1\n\n- {subjects: (rust), time: 45m} Second");
    expect(files.get("week.md")).toContain("| p1 | Fri | Session | rust | 45 |");
    expect(files.get("week.md")).not.toContain("First");
  });

  it("adds multiple planned activities with default metadata", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.addPlanEntry("Fri");
    const entry = store.plan[0];

    expect(store.addPlanActivities(entry.id, ["One", "Two"])).toBe(true);
    expect(entry.activities.slice(-2)).toMatchObject([
      { subjects: ["general"], minutes: 0, description: "One" },
      { subjects: ["general"], minutes: 0, description: "Two" }
    ]);
    await store.flushSave();
    expect(files.get("week.md")).toContain("- {subjects: (general), time: 0m} One");
    expect(files.get("week.md")).toContain("- {subjects: (general), time: 0m} Two");
  });

  it("does not add planned activities for missing entries or empty descriptions", async () => {
    const { store } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.addPlanEntry("Fri");
    const entry = store.plan[0];

    expect(store.addPlanActivities("missing", ["One"])).toBe(false);
    expect(store.addPlanActivities(entry.id, [" ", ""])).toBe(false);
    expect(entry.activities).toHaveLength(1);
  });

  it("serializes empty plan activity summaries as general zero", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.addPlanEntry("Fri");
    const entry = store.plan[0];
    store.removePlanActivity(entry.id, entry.activities[0].id);
    await store.flushSave();
    expect(files.get("week.md")).toContain("| p1 | Fri | Session | general | 0 |");
  });

  it("reorders plan entries only within one day", async () => {
    const { store } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.plan = [
      { id: "p1", day: "Mon", session: "First", subjects: ["general"], targetMinutes: 0, activities: [] },
      { id: "p2", day: "Mon", session: "Second", subjects: ["general"], targetMinutes: 0, activities: [] },
      { id: "p3", day: "Tue", session: "Third", subjects: ["general"], targetMinutes: 0, activities: [] }
    ];

    expect(store.movePlanEntryWithinDay("p2", "p1", "before")).toBe(true);
    expect(store.plan.map((entry) => entry.id)).toEqual(["p2", "p1", "p3"]);
    expect(store.movePlanEntryWithinDay("p3", "p1", "before")).toBe(false);
  });

  it("refreshes actual from the loaded daily document when provided", async () => {
    const { store, files } = harness();
    files.set("stale-day.md", "# 2026-06-22\n\n## Work\n\n- {subjects: (rust), time: 10m} Old\n\n## Total Time\n\n10m\n\n## Notes\n");
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" }, [{ date: "2026-06-22", path: "stale-day.md" }]);

    await store.refreshActualWithDaily("2026-06-22", [
      { id: "session-1", name: "Work", activities: [{ id: "activity-1", subjects: ["rust"], minutes: 25, description: "Current" }] }
    ]);

    expect(store.actual).toEqual([{ day: "Mon", session: "Work", subjects: ["rust"], actualMinutes: 25 }]);
    expect(files.get("week.md")).toContain("| Mon | Work | rust | 25 |");
  });
});
