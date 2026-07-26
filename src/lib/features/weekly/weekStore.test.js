// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { WeekStore } from "./weekStore.svelte.js";

const index = `# 2026 - Week 26 - June 22-28\n\n## Objectives\n\n- {subjects: (rust), status: open} Ship.\n\n## Weekly Plan\n\n| ID | Day | Session | Subjects | Target Minutes |\n| --- | --- | --- | --- | ---: |\n\n## Weekly Plan Details\n\n<!-- tracker:plan-details:start -->\n<!-- tracker:plan-details:end -->\n\n## Weekly Actual\n\n<!-- tracker:actual:start -->\n| Day | Session | Subjects | Actual Minutes |\n| --- | --- | --- | ---: |\n<!-- tracker:actual:end -->\n\n## Notes\n`;

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

function weekWithObjectives(label, lines) {
  return index
    .replace("# 2026 - Week 26 - June 22-28", `# 2026 - Week 26 - ${label}`)
    .replace("- {subjects: (rust), status: open} Ship.", lines.join("\n"));
}

describe("WeekStore editing", () => {
  it("unloads a recycled week without retaining persistence or presentation state", async () => {
    const { store } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.foldedObjectiveIds = ["objective-0"];

    store.unload();

    expect(store.loaded).toBe(false);
    expect(store.path).toBe("");
    expect(store.objectives).toEqual([]);
    expect(store.plan).toEqual([]);
    expect(store.actual).toEqual([]);
    expect(store.foldedObjectiveIds).toEqual([]);
    expect(store.persistence.path).toBe("");
    expect(store.persistence.baseContent).toBe("");
  });

  it("restores independent objective folds when switching between weekly files", async () => {
    const { store, files } = harness();
    files.set("A.md", weekWithObjectives("A", [
      "- {subjects: (general), status: open} A parent",
      "  - {subjects: (general), status: open} A child"
    ]));
    files.set("B.md", weekWithObjectives("B", [
      "- {subjects: (general), status: open} B parent",
      "  - {subjects: (general), status: open} B child"
    ]));

    await store.loadPath("A.md", { year: 2026, week: 26, rangeLabel: "A" });
    store.toggleObjectiveFold(store.objectives[0].id);
    expect(store.foldedObjectiveIds).toEqual(["objective-0"]);

    await store.loadPath("B.md", { year: 2026, week: 27, rangeLabel: "B" });
    store.toggleObjectiveFold(store.objectives[0].id);
    expect(store.foldedObjectiveIds).toEqual(["objective-0"]);

    await store.loadPath("A.md", { year: 2026, week: 26, rangeLabel: "A" });
    expect(store.foldedObjectiveIds).toEqual(["objective-0"]);
    await store.loadPath("B.md", { year: 2026, week: 27, rangeLabel: "B" });
    expect(store.foldedObjectiveIds).toEqual(["objective-0"]);
  });

  it("rebases cached folds after app-owned structural edits", async () => {
    const { store, files } = harness();
    files.set("A.md", weekWithObjectives("A", [
      "- {subjects: (general), status: open} Intro",
      "- {subjects: (general), status: open} Parent",
      "  - {subjects: (general), status: open} Child"
    ]));
    files.set("B.md", weekWithObjectives("B", [
      "- {subjects: (general), status: open} Other"
    ]));

    await store.loadPath("A.md", { year: 2026, week: 26, rangeLabel: "A" });
    const [intro, parent] = store.objectives;
    store.toggleObjectiveFold(parent.id);
    store.updateObjective(parent.id, { status: "partial", description: "Updated parent" });
    store.removeObjective(intro.id);
    expect(store.foldedObjectiveIds).toEqual([parent.id]);

    await store.loadPath("B.md", { year: 2026, week: 27, rangeLabel: "B" });
    await store.loadPath("A.md", { year: 2026, week: 26, rangeLabel: "A" });

    expect(store.objectives[0]).toMatchObject({ description: "Updated parent", status: "partial" });
    expect(store.foldedObjectiveIds).toEqual(["objective-0"]);
  });

  it("invalidates stale folds when a weekly file changes externally while inactive", async () => {
    const { store, files } = harness();
    files.set("A.md", weekWithObjectives("A", [
      "- {subjects: (general), status: open} Parent",
      "  - {subjects: (general), status: open} Child"
    ]));
    files.set("B.md", weekWithObjectives("B", [
      "- {subjects: (general), status: open} Other"
    ]));

    await store.loadPath("A.md", { year: 2026, week: 26, rangeLabel: "A" });
    store.toggleObjectiveFold(store.objectives[0].id);
    await store.loadPath("B.md", { year: 2026, week: 27, rangeLabel: "B" });
    files.set("A.md", files.get("A.md").replace("Parent", "Externally changed parent"));

    await store.loadPath("A.md", { year: 2026, week: 26, rangeLabel: "A" });
    expect(store.foldedObjectiveIds).toEqual([]);
  });

  it("prunes invalid folds and clears the current week on external reload", async () => {
    const { store, files } = harness();
    files.set("A.md", weekWithObjectives("A", [
      "- {subjects: (general), status: open} Parent",
      "  - {subjects: (general), status: open} Child",
      "    - {subjects: (general), status: open} Grandchild"
    ]));

    await store.loadPath("A.md", { year: 2026, week: 26, rangeLabel: "A" });
    const [parent, child, grandchild] = store.objectives;
    store.setObjectiveFolds([parent.id, child.id]);
    store.removeObjective(grandchild.id);
    expect(store.foldedObjectiveIds).toEqual([parent.id]);

    store.applyExternal(files.get("A.md"));
    expect(store.foldedObjectiveIds).toEqual([]);
  });

  it("clears the current week folds when an external conflict is reloaded", async () => {
    const { store, files } = harness();
    files.set("A.md", weekWithObjectives("A", [
      "- {subjects: (general), status: open} Parent",
      "  - {subjects: (general), status: open} Child"
    ]));

    await store.loadPath("A.md", { year: 2026, week: 26, rangeLabel: "A" });
    store.toggleObjectiveFold(store.objectives[0].id);
    store.updateNotes("local pending");
    files.set("A.md", files.get("A.md").replace("Parent", "External parent"));
    await store.flushSave();
    expect(store.conflict).toBeTruthy();

    await store.resolveConflict("reload");

    expect(store.foldedObjectiveIds).toEqual([]);
    expect(store.objectives[0].description).toBe("External parent");
  });

  it("starts a fresh store without session fold state", () => {
    const first = harness().store;
    first.foldedObjectiveIds = ["objective-0"];

    expect(harness().store.foldedObjectiveIds).toEqual([]);
  });

  it("persists objective state changes", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.updateObjective(store.objectives[0].id, { status: "partial" });
    await store.flushSave();
    expect(files.get("week.md")).toContain("subjects: (rust), status: partial");
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

  it("adds weekly plan entries without a placeholder activity", async () => {
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
      activities: []
    });
    expect(files.get("week.md")).toContain("| p1 | Tue | Session | general | 0 |");
    expect(files.get("week.md")).not.toContain("### p1");
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

  it("duplicates a complete plan entry after its source with fresh IDs", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.plan = [
      {
        id: "p3",
        day: "Thu",
        session: "Deep work",
        subjects: ["rust", "planning"],
        targetMinutes: 90,
        activities: [
          { id: "original-known", subjects: ["rust"], minutes: 45, description: "Implement" },
          { id: "original-unknown", subjects: ["planning"], minutes: null, description: "Investigate" }
        ]
      },
      { id: "p8", day: "Thu", session: "Review", subjects: ["general"], targetMinutes: 30, activities: [] }
    ];

    expect(store.duplicatePlanEntry("p3")).toBe(true);
    expect(store.plan.map((entry) => entry.id)).toEqual(["p3", "p9", "p8"]);
    expect(store.plan[1]).toMatchObject({
      day: "Thu",
      session: "Deep work",
      subjects: ["rust", "planning"],
      targetMinutes: 90,
      activities: [
        { subjects: ["rust"], minutes: 45, description: "Implement" },
        { subjects: ["planning"], minutes: null, description: "Investigate" }
      ]
    });
    expect(store.plan[1].subjects).not.toBe(store.plan[0].subjects);
    expect(store.plan[1].activities).not.toBe(store.plan[0].activities);
    expect(store.plan[1].activities.map((activity) => activity.id)).not.toEqual(["original-known", "original-unknown"]);
    expect(store.plan[1].activities.every((activity, index) => activity.subjects !== store.plan[0].activities[index].subjects)).toBe(true);
    expect(store.duplicatePlanEntry("missing")).toBe(false);

    await store.flushSave();
    expect(files.get("week.md")).toContain("| p9 | Thu | Deep work | rust, planning | 45+ |");
    expect(files.get("week.md")).toContain("### p9");
  });

  it("returns sorted unique session names from the whole week", () => {
    const { store } = harness();
    store.plan = [
      { day: "Mon", session: "  Zeta  " },
      { day: "Mon", session: "beta" },
      { day: "Mon", session: "Alpha" },
      { day: "Mon", session: "BETA" },
      { day: "Mon", session: " " },
      { day: "Tue", session: "Other day" }
    ];

    expect(store.currentWeekSessionNames()).toEqual(["Alpha", "beta", "Other day", "Zeta"]);
  });

  it("adds multiple objectives with default metadata", async () => {
    const { store } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    expect(store.addObjectives(["One", "Two"])).toBe(true);
    expect(store.objectives.slice(-2)).toMatchObject([
      { subjects: ["general"], status: "open", description: "One", indent: 0 },
      { subjects: ["general"], status: "open", description: "Two", indent: 0 }
    ]);
    expect(store.objectives.slice(-2).every((objective) => !("origin" in objective))).toBe(true);
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

  it("indents and outdents only the selected objective within level bounds", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.addObjectives(["Second"]);
    const [first, second] = store.objectives;

    expect(store.indentObjective(second.id)).toBe(true);
    expect(store.indentObjective(second.id)).toBe(true);
    expect(store.indentObjective(second.id)).toBe(false);
    expect(store.objectives.map((objective) => objective.indent)).toEqual([0, 2]);
    expect(store.outdentObjective(second.id)).toBe(true);
    expect(store.outdentObjective(second.id)).toBe(true);
    expect(store.outdentObjective(second.id)).toBe(false);
    expect(store.objectives.map((objective) => objective.indent)).toEqual([0, 0]);
    expect(store.indentObjective("missing")).toBe(false);
    expect(first.indent).toBe(0);

    store.indentObjective(second.id);
    await store.flushSave();
    expect(files.get("week.md")).toContain("  - {subjects: (general), status: open} Second");
  });

  it("preserves independent indentation when moving and deleting objectives", async () => {
    const { store } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.addObjectives(["Second", "Third"]);
    const [first, second, third] = store.objectives;
    second.indent = 1;
    third.indent = 2;

    expect(store.moveObjective(third.id, "up")).toBe(true);
    expect(store.objectives.map(({ description, indent }) => ({ description, indent }))).toEqual([
      { description: "Ship.", indent: 0 },
      { description: "Third", indent: 2 },
      { description: "Second", indent: 1 }
    ]);
    store.removeObjective(first.id);
    expect(store.objectives.map((objective) => objective.indent)).toEqual([2, 1]);
  });

  it("edits and reorders planned activities", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.addPlanEntry("Fri");
    const entry = store.plan[0];
    store.addPlanActivity(entry.id);
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
    expect(entry.activities).toHaveLength(0);
  });

  it("serializes empty plan activity summaries as general zero", async () => {
    const { store, files } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.addPlanEntry("Fri");
    const entry = store.plan[0];
    await store.flushSave();
    expect(files.get("week.md")).toContain("| p1 | Fri | Session | general | 0 |");
  });

  it("reorders plan entries across days", async () => {
    const { store } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.plan = [
      { id: "p1", day: "Mon", session: "First", subjects: ["general"], targetMinutes: 0, activities: [] },
      { id: "p2", day: "Mon", session: "Second", subjects: ["general"], targetMinutes: 0, activities: [] },
      { id: "p3", day: "Tue", session: "Third", subjects: ["general"], targetMinutes: 0, activities: [] }
    ];

    expect(store.movePlanEntry("p3", "p1", "before")).toBe(true);
    expect(store.plan.map((entry) => `${entry.id}:${entry.day}`)).toEqual(["p3:Mon", "p1:Mon", "p2:Mon"]);
    expect(store.movePlanEntry("p3", "p3", "before")).toBe(false);
    expect(store.movePlanEntry("missing", "p1", "before")).toBe(false);
  });

  it("moves plan entries to the end of a day", async () => {
    const { store } = harness();
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" });
    store.plan = [
      { id: "p1", day: "Mon", session: "First", subjects: ["general"], targetMinutes: 0, activities: [] },
      { id: "p2", day: "Wed", session: "Second", subjects: ["general"], targetMinutes: 0, activities: [] },
      { id: "p3", day: "Wed", session: "Third", subjects: ["general"], targetMinutes: 0, activities: [] }
    ];

    expect(store.movePlanEntryToDay("p1", "Wed")).toBe(true);
    expect(store.plan.map((entry) => `${entry.id}:${entry.day}`)).toEqual(["p2:Wed", "p3:Wed", "p1:Wed"]);
    expect(store.movePlanEntryToDay("missing", "Wed")).toBe(false);
    expect(store.movePlanEntryToDay("p1", "Bad")).toBe(false);
  });

  it("refreshes actual from the loaded daily document when provided", async () => {
    const { store, files } = harness();
    files.set("stale-day.md", "# 2026-06-22\n\n## Work\n\n- {subjects: (rust), time: 10m} Old\n\n## Total Time\n\n10m\n\n## Notes\n");
    await store.loadPath("week.md", { year: 2026, week: 26, rangeLabel: "June 22-28" }, [{ date: "2026-06-22", path: "stale-day.md" }]);

    await store.refreshActualWithDaily("2026-06-22", [
      { id: "session-1", name: "Work", activities: [{ id: "activity-1", subjects: ["rust"], minutes: 25, description: "Current" }] }
    ]);

    expect(store.actual).toEqual([{
      day: "Mon",
      session: "Work",
      subjects: ["rust"],
      actualMinutes: 25,
      activities: [{ description: "Current", subjects: ["rust"], minutes: 25 }]
    }]);
    expect(files.get("week.md")).toContain("| Mon | Work | rust | 25 |");
  });
});
