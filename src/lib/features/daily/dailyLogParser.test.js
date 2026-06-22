import { describe, expect, it } from "vitest";
import { parseDailyLog, parseLegacySessionActivities, serializeDailyLog } from "./dailyLogParser.js";

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

  it("preserves preamble and unrecognized lines inside sessions", () => {
    const input = `# 2026-06-22\n\nIntro paragraph.\n\n## Work\n\nKeep this raw line.\n- {subjects: (rust), time: 15m} Code.\n\n## Notes\n\nRaw notes.\n`;
    const serialized = serializeDailyLog(parseDailyLog(input));
    expect(serialized).toContain("Intro paragraph.");
    expect(serialized).toContain("Keep this raw line.");
  });

  it("displays safely convertible legacy activity lists without migration", () => {
    const legacy = `**subjects:**\n- programming\n\n**time:**\n- 120 min\n\n**details:**\n- Readme oluşturuldu.\n- Git kontrol edildi.\n\n---`;
    expect(parseLegacySessionActivities(legacy)).toEqual([{
      subjects: ["programming"],
      minutes: 120,
      description: "Readme oluşturuldu. Git kontrol edildi."
    }]);
    const parsed = parseDailyLog(`# 2026-06-20\n\n## Deep 1\n\n${legacy}\n\n## Total Time\n\n2 h\n\n## Notes\n\n- not`);
    expect(parsed.sessions[0].activities[0].minutes).toBe(120);
    expect(parsed.totalMinutes).toBe(120);
  });

  it("leaves ambiguous legacy lists untouched", () => {
    const legacy = `**subjects:**\n- rust\n- test\n**time:**\n- 30 min\n**details:**\n- one\n- two`;
    const parsed = parseDailyLog(`# 2026-06-20\n\n## Work\n\n${legacy}`);
    expect(parsed.sessions[0].activities).toHaveLength(0);
    expect(parsed.sessions[0].rawLines.join("\n")).toContain("**subjects:**");
  });
});
