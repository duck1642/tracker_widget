// @ts-nocheck
import { describe, expect, it } from "vitest";
import { parseDailyLog, serializeDailyLog } from "./dailyLogParser.js";

const source = `---\ntitle: "opaque"\ncustom: { untouched: true }\n---\n\n# 2026-06-22\n\n## Geliştirme\n\n- {subjects: (rust, programlama), time: 90m} Ayrıştırıcı yazıldı.\n- {subjects: (test), time: 30m} Testler eklendi.\n\n## Total Time\n\n999m\n\n---\n\n## Notes\n\n- **Ham** Markdown korunur.\n`;

describe("daily log parser", () => {
  it("keeps YAML opaque and calculates totals from activities", () => {
    const document = parseDailyLog(source, "2026-06-22");
    expect(document.frontmatterRaw).toContain("custom: { untouched: true }");
    expect(document.sessions[0].name).toBe("Geliştirme");
    expect(document.sessions[0].activities).toHaveLength(2);
    expect(document.totalMinutes).toBe(120);
    expect(document.notesRaw).toContain("**Ham**");
  });

  it("round trips app-owned content without changing frontmatter", () => {
    const serialized = serializeDailyLog(parseDailyLog(source, "2026-06-22"));
    expect(serialized).toContain("custom: { untouched: true }");
    expect(serialized).toContain("## Geliştirme");
    expect(serialized).toContain("120m");
  });

  it("parses metadata-only activities as empty activity rows", () => {
    const input = `# 2026-06-22\n\n## Work\n\n- {subjects: (general), time: 0m}\n\n## Notes\n\n-\n`;
    const document = parseDailyLog(input, "2026-06-22");
    expect(document.sessions[0].activities).toHaveLength(1);
    expect(document.sessions[0].activities[0]).toMatchObject({ subjects: ["general"], minutes: 0, description: "" });
    expect(document.sessions[0].rawLines).toHaveLength(0);
    expect(serializeDailyLog(document)).toContain("- {subjects: (general), time: 0m}");
  });

  it("preserves unknown durations and marks the calculated total as incomplete", () => {
    const input = `# 2026-06-22\n\n## Work\n\n- {subjects: (general), time: 30m} Known.\n- {subjects: (general), time: ?} Unknown.\n\n## Total Time\n\n999m\n\n## Notes\n`;
    const document = parseDailyLog(input);
    expect(document.sessions[0].activities.map((activity) => activity.minutes)).toEqual([30, null]);
    expect(document).toMatchObject({ totalMinutes: 30, unknownDurationCount: 1 });
    expect(serializeDailyLog(document)).toContain("## Total Time\n\n30m+");
  });

  it("preserves preamble and unrecognized lines inside sessions", () => {
    const input = `# 2026-06-22\n\nIntro paragraph.\n\n## Work\n\nKeep this raw line.\n- {subjects: (rust), time: 15m} Code.\n\n## Notes\n\nRaw notes.\n`;
    const serialized = serializeDailyLog(parseDailyLog(input));
    expect(serialized).toContain("Intro paragraph.");
    expect(serialized).toContain("Keep this raw line.");
  });

  it("serializes empty daily notes without a starter bullet", () => {
    const serialized = serializeDailyLog(parseDailyLog("# 2026-06-22\n\n## Total Time\n\n0m\n\n## Notes\n"));
    expect(serialized).toContain("## Notes\n\n````tracker-notes\n````");
    expect(serialized).not.toContain("## Notes\n\n-");
  });

  it("keeps headings inside terminal legacy notes instead of creating sessions", () => {
    const input = "# 2026-06-22\n\n## Work\n\n- {subjects: (rust), time: 15m} Code.\n\n## Total Time\n\n15m\n\n## Notes\n\n# Note title\n\n## Nested note heading\n\nText";
    const document = parseDailyLog(input);

    expect(document.sessions.map((session) => session.name)).toEqual(["Work"]);
    expect(document.notesRaw).toBe("# Note title\n\n## Nested note heading\n\nText");
    expect(serializeDailyLog(document)).toContain(
      "## Notes\n\n````tracker-notes\n# Note title\n\n## Nested note heading\n\nText\n````"
    );
  });

});
