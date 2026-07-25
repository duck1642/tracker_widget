import { describe, expect, it } from "vitest";
import { parseWeeklyIndex, serializeWeeklyIndex } from "./weeklyIndexParser.js";
import { aggregateWeeklyActual } from "./actualAggregator.js";

const weekly = `---\ntitle: test\n---\n\n# 2026 - Week 26 - June 22-28\n\n## Objectives\n\n- {subjects: (rust), status: open} Build parser.\n\n## Weekly Plan\n\n| ID | Day | Session | Subjects | Target Minutes |\n| --- | --- | --- | --- | ---: |\n| p1 | Mon | Dev \\| Review | rust, test | 120 |\n| p2 | Mon | Reading | reading | 60 |\n\n## Weekly Plan Details\n\n<!-- tracker:plan-details:start -->\n\n### p1\n\n- {subjects: (rust), time: 30m} Draft parser tests\n\n### orphan\n\n- {subjects: (lost), time: 10m} Ignore me\n\n<!-- tracker:plan-details:end -->\n\n## Weekly Actual\n\n<!-- tracker:actual:start -->\n| Day | Session | Subjects | Actual Minutes |\n| --- | --- | --- | ---: |\n<!-- tracker:actual:end -->\n\n## Notes\n\nRaw notes.\n`;

describe("weekly index parser", () => {
  it("parses objectives, plan IDs, details, and escaped table cells", () => {
    const document = parseWeeklyIndex(weekly, { year: 2026, week: 26 });
    expect(document.objectives[0]).toMatchObject({ status: "open", indent: 0 });
    expect(document.plan[0]).toMatchObject({ id: "p1", session: "Dev | Review" });
    expect(document.plan[0].activities[0]).toMatchObject({ subjects: ["rust"], minutes: 30, description: "Draft parser tests" });
  });

  it("parses metadata-only objectives as empty objective rows", () => {
    const input = weekly.replace(
      "- {subjects: (rust), status: open} Build parser.",
      "- {subjects: (general), status: open}"
    );
    const document = parseWeeklyIndex(input, { year: 2026, week: 26 });
    expect(document.objectives).toHaveLength(1);
    expect(document.objectives[0]).toMatchObject({ subjects: ["general"], status: "open", description: "", indent: 0 });
    expect(document.objectiveRawLines).toHaveLength(0);
    expect(serializeWeeklyIndex(document)).toContain("- {subjects: (general), status: open}");
  });

  it("parses zero minute table values without dropping rows", () => {
    const input = weekly
      .replace("| p2 | Mon | Reading | reading | 60 |", "| p2 | Tue | Reading | reading | 0 |")
      .replace(
        "<!-- tracker:actual:start -->\n| Day | Session | Subjects | Actual Minutes |\n| --- | --- | --- | ---: |",
        "<!-- tracker:actual:start -->\n| Day | Session | Subjects | Actual Minutes |\n| --- | --- | --- | ---: |\n| Tue | Reading | reading | 0 |"
      );
    const document = parseWeeklyIndex(input, { year: 2026, week: 26 });
    expect(document.plan[1]).toMatchObject({ day: "Tue", session: "Reading", targetMinutes: 0 });
    expect(document.actual[0]).toMatchObject({ day: "Tue", session: "Reading", actualMinutes: 0 });
  });

  it("clamps negative minute table values to zero", () => {
    const input = weekly
      .replace("| p2 | Mon | Reading | reading | 60 |", "| p2 | Tue | Reading | reading | -15 |")
      .replace(
        "<!-- tracker:actual:start -->\n| Day | Session | Subjects | Actual Minutes |\n| --- | --- | --- | ---: |",
        "<!-- tracker:actual:start -->\n| Day | Session | Subjects | Actual Minutes |\n| --- | --- | --- | ---: |\n| Tue | Reading | reading | -5 |"
      );
    const document = parseWeeklyIndex(input, { year: 2026, week: 26 });
    expect(document.plan[1]).toMatchObject({ targetMinutes: 0 });
    expect(document.actual[0]).toMatchObject({ actualMinutes: 0 });
  });

  it("serializes generated actual rows only inside markers", () => {
    const document = parseWeeklyIndex(weekly, { year: 2026, week: 26 });
    document.actual = [{ day: "Mon", session: "Dev | Review", subjects: ["rust"], actualMinutes: 90 }];
    const serialized = serializeWeeklyIndex(document);
    expect(serialized).toContain("| p1 | Mon | Dev \\| Review | rust | 30 |");
    expect(serialized).toContain("| p2 | Mon | Reading | general | 0 |");
    expect(serialized).toContain("### p1\n\n- {subjects: (rust), time: 30m} Draft parser tests");
    expect(serialized).not.toContain("orphan");
    expect(serialized).toContain("| Mon | Dev \\| Review | rust | 90 |");
    expect(serialized).toContain("Raw notes.");
  });

  it("derives table summaries from planned activities", () => {
    const document = parseWeeklyIndex(weekly, { year: 2026, week: 26 });
    document.plan[0].activities.push({ id: "extra", subjects: ["test", "rust"], minutes: 15, description: "Review" });
    const serialized = serializeWeeklyIndex(document);
    expect(serialized).toContain("| p1 | Mon | Dev \\| Review | rust, test | 45 |");
  });

  it("loads missing plan details as empty planned activities", () => {
    const input = weekly.replace(/## Weekly Plan Details[\s\S]*?## Weekly Actual/, "## Weekly Actual");
    const document = parseWeeklyIndex(input, { year: 2026, week: 26 });
    expect(document.plan[0].activities).toEqual([]);
  });

  it("preserves Markdown outside app-owned sections", () => {
    const input = weekly.replace("## Objectives", "Intro copy.\n\n## Reference\n\nDo not remove this.\n\n## Objectives");
    const serialized = serializeWeeklyIndex(parseWeeklyIndex(input, { year: 2026, week: 26 }));
    expect(serialized).toContain("Intro copy.");
    expect(serialized).toContain("## Reference\n\nDo not remove this.");
  });

  it("preserves malformed objective lines without reclassifying them", () => {
    const malformed = weekly.replace(
      "- {subjects: (rust), status: open} Build parser.",
      "- {subjects: (rust), orgin: unplanned, status: open} Keep this exact line."
    );
    const document = parseWeeklyIndex(malformed, { year: 2026, week: 26 });
    expect(document.objectives).toHaveLength(0);
    expect(serializeWeeklyIndex(document)).toContain("orgin: unplanned, status: open");
  });

  it("preserves unsupported origin metadata as raw Markdown", () => {
    const legacyLine = "- {subjects: (rust), origin: planned, status: open} Preserve imported legacy data.";
    const input = weekly.replace("- {subjects: (rust), status: open} Build parser.", legacyLine);
    const document = parseWeeklyIndex(input, { year: 2026, week: 26 });

    expect(document.objectives).toHaveLength(0);
    expect(document.objectiveRawLines).toEqual([legacyLine]);
    expect(serializeWeeklyIndex(document)).toContain(legacyLine);
  });

  it("keeps headings inside terminal legacy notes and serializes a wrapped subdocument", () => {
    const input = weekly.replace("Raw notes.", "# Note title\n\n## Nested note heading\n\nText");
    const document = parseWeeklyIndex(input, { year: 2026, week: 26 });

    expect(document.notesRaw).toBe("# Note title\n\n## Nested note heading\n\nText");
    expect(document.unknownSectionsRaw).not.toContain("## Nested note heading\n\nText");
    expect(serializeWeeklyIndex(document)).toContain(
      "## Notes\n\n````tracker-notes\n# Note title\n\n## Nested note heading\n\nText\n````"
    );
  });

  it("parses and serializes flat objective indentation levels zero through two", () => {
    const input = weekly.replace(
      "- {subjects: (rust), status: open} Build parser.",
      [
        "- {subjects: (one), status: open} Top.",
        "  - {subjects: (two), status: partial} Child.",
        "\t\t- {subjects: (three), status: done} Grandchild."
      ].join("\n")
    );
    const document = parseWeeklyIndex(input, { year: 2026, week: 26 });

    expect(document.objectives.map(({ indent, description }) => ({ indent, description }))).toEqual([
      { indent: 0, description: "Top." },
      { indent: 1, description: "Child." },
      { indent: 2, description: "Grandchild." }
    ]);
    expect(serializeWeeklyIndex(document)).toContain(
      "- {subjects: (one), status: open} Top.\n  - {subjects: (two), status: partial} Child.\n    - {subjects: (three), status: done} Grandchild."
    );
  });

  it("preserves malformed and over-depth objective indentation as raw Markdown", () => {
    const input = weekly.replace(
      "- {subjects: (rust), status: open} Build parser.",
      [
        " - {subjects: (odd), status: open} Odd indentation.",
        "      - {subjects: (deep), status: open} Too deep."
      ].join("\n")
    );
    const document = parseWeeklyIndex(input, { year: 2026, week: 26 });

    expect(document.objectives).toHaveLength(0);
    const serialized = serializeWeeklyIndex(document);
    expect(serialized).toContain(" - {subjects: (odd), status: open} Odd indentation.");
    expect(serialized).toContain("      - {subjects: (deep), status: open} Too deep.");
  });
});

describe("weekly actual aggregation", () => {
  it("merges same-session activities and preserves daily session order", () => {
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
      { day: "Mon", session: "Custom", subjects: ["art"], actualMinutes: 20, activities: [{ description: undefined, subjects: ["art"], minutes: 20 }] },
      {
        day: "Mon",
        session: "Development",
        subjects: ["rust", "test"],
        actualMinutes: 90,
        activities: [
          { description: undefined, subjects: ["rust"], minutes: 60 },
          { description: undefined, subjects: ["test", "rust"], minutes: 30 }
        ]
      }
    ]);
  });

  it("coalesces duplicate same-day session headings", () => {
    const days = [{ day: "Mon", sessions: [
      { name: "Work", activities: [{ subjects: ["rust"], minutes: 20 }] },
      { name: "work", activities: [{ subjects: ["test", "rust"], minutes: 10 }] }
    ] }];
    expect(aggregateWeeklyActual([], days)).toEqual([
      {
        day: "Mon",
        session: "Work",
        subjects: ["rust", "test"],
        actualMinutes: 30,
        activities: [
          { description: undefined, subjects: ["rust"], minutes: 20 },
          { description: undefined, subjects: ["test", "rust"], minutes: 10 }
        ]
      }
    ]);
  });
});
