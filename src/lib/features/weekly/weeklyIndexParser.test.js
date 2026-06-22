import { describe, expect, it } from "vitest";
import { parseWeeklyIndex, serializeWeeklyIndex } from "./weeklyIndexParser.js";
import { aggregateWeeklyActual } from "./actualAggregator.js";

const weekly = `---\ntitle: test\n---\n\n# 2026 - Week 26 - June 22–28\n\n## Objectives\n\n- {subjects: (rust), origin: planned, status: open} Build parser.\n\n## Weekly Plan\n\n| Day | Session | Subjects | Target Minutes |\n| --- | --- | --- | ---: |\n| Mon | Dev \\| Review | rust, test | 120 |\n| Mon | Reading | reading | 60 |\n\n## Weekly Actual\n\n<!-- tracker:actual:start -->\n| Day | Session | Subjects | Actual Minutes |\n| --- | --- | --- | ---: |\n<!-- tracker:actual:end -->\n\n## Notes\n\nRaw notes.\n`;

describe("weekly index parser", () => {
  it("parses objectives and escaped table cells", () => {
    const document = parseWeeklyIndex(weekly, { year: 2026, week: 26 });
    expect(document.objectives[0]).toMatchObject({ origin: "planned", status: "open" });
    expect(document.plan[0].session).toBe("Dev | Review");
  });

  it("serializes generated actual rows only inside markers", () => {
    const document = parseWeeklyIndex(weekly, { year: 2026, week: 26 });
    document.actual = [{ day: "Mon", session: "Dev | Review", subjects: ["rust"], actualMinutes: 90 }];
    const serialized = serializeWeeklyIndex(document);
    expect(serialized).toContain("| Mon | Dev \\| Review | rust | 90 |");
    expect(serialized).toContain("Raw notes.");
  });

  it("preserves Markdown outside app-owned sections", () => {
    const input = weekly.replace("## Objectives", "Intro copy.\n\n## Reference\n\nDo not remove this.\n\n## Objectives");
    const serialized = serializeWeeklyIndex(parseWeeklyIndex(input, { year: 2026, week: 26 }));
    expect(serialized).toContain("Intro copy.");
    expect(serialized).toContain("## Reference\n\nDo not remove this.");
  });
});

describe("weekly actual aggregation", () => {
  it("merges same-session activities and orders planned before custom", () => {
    const plan = [
      { day: "Mon", session: "Development", subjects: ["rust"], targetMinutes: 120 },
      { day: "Mon", session: "Reading", subjects: ["reading"], targetMinutes: 60 }
    ];
    const days = [{
      day: "Mon",
      sessions: [
        { name: "Custom", activities: [{ subjects: ["art"], minutes: 20 }] },
        { name: "development", activities: [
          { subjects: ["rust"], minutes: 60 },
          { subjects: ["test", "rust"], minutes: 30 }
        ] }
      ]
    }];
    expect(aggregateWeeklyActual(plan, days)).toEqual([
      { day: "Mon", session: "Development", subjects: ["rust", "test"], actualMinutes: 90 },
      { day: "Mon", session: "Custom", subjects: ["art"], actualMinutes: 20 }
    ]);
  });

  it("coalesces duplicate same-day session headings", () => {
    const days = [{ day: "Mon", sessions: [
      { name: "Work", activities: [{ subjects: ["rust"], minutes: 20 }] },
      { name: "work", activities: [{ subjects: ["test", "rust"], minutes: 10 }] }
    ] }];
    expect(aggregateWeeklyActual([], days)).toEqual([
      { day: "Mon", session: "Work", subjects: ["rust", "test"], actualMinutes: 30 }
    ]);
  });
});
