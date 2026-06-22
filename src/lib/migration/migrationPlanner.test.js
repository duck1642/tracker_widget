import { describe, expect, it } from "vitest";
import { planLegacyDailyMigration, planLegacyWeeklyMigration } from "./migrationPlanner.js";

describe("legacy daily migration", () => {
  it("converts parallel lists and legacy minute syntax", () => {
    const source = `---\ntitle: legacy\n---\n# 2026-06-15\n## Deep 1\n**subjects:**\n- rust\n**time:**\n- 120 min\n**details:**\n- Built parser.\n---\n## Total Time\n2h\n---\n## Notes\n- note\n`;
    const result = planLegacyDailyMigration(source, "2026-06-15");
    expect(result.status).toBe("migratable");
    expect(result.output).toContain("time: 120m");
    expect(result.output).toContain("120m");
    expect(result.output).toContain("title: legacy");
  });

  it("marks irreconcilable parallel lists ambiguous", () => {
    const source = `# 2026-06-15\n## Work\n**subjects:**\n- rust\n- test\n**time:**\n- 30 min\n**details:**\n- one\n- two\n- three\n`;
    expect(planLegacyDailyMigration(source, "2026-06-15").status).toBe("ambiguous");
  });

  it("classifies empty current files and rejects mixed formats", () => {
    const current = `# 2026-06-15\n\n## Total Time\n\n0m\n\n## Notes\n`;
    const mixed = `${current}\n## Work\n- {subjects: (rust), time: 5m} New.\n**subjects:**\n- rust\n**time:**\n- 5 min\n**details:**\n- Old.\n`;
    expect(planLegacyDailyMigration(current, "2026-06-15").status).toBe("current");
    expect(planLegacyDailyMigration(mixed, "2026-06-15").status).toBe("ambiguous");
  });
});

describe("legacy weekly migration", () => {
  it("converts checkboxes and an empty legacy plan safely", () => {
    const source = `---\ntitle: week\n---\n# 2026 - Week 25 - June 15-21\n## Objectives\n- [x] {subjects: (math), goal: "Finish logic"}\n## Plan\n| Day | Deep 1 | Deep 2 | Target Hours |\n| --- | --- | --- | --- |\n| Mon | math | | |\n## Notes\n- raw\n`;
    const result = planLegacyWeeklyMigration(source, { year: 2026, week: 25, rangeLabel: "June 15–21" });
    expect(result.status).toBe("migratable");
    expect(result.output).toContain("origin: planned, status: done");
    expect(result.output).toContain("| Mon | Deep 1 | math | 0 |");
    expect(result.output).toContain("title: week");
  });

  it("converts a legacy plan with target hours safely", () => {
    const source = `# Week\n## Objectives\n## Plan\n| Day | Deep 1 | Target Hours |\n| --- | --- | --- |\n| Mon | math | 9 |\n`;
    expect(planLegacyWeeklyMigration(source, { year: 2026, week: 25 }).status).toBe("migratable");
  });
});
