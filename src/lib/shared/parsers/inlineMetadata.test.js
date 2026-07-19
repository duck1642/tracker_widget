import { describe, expect, it } from "vitest";
import { parseActivityLine, parseObjectiveLine, serializeObjectiveLine } from "./inlineMetadata.js";

describe("inline metadata", () => {
  it("parses Unicode subjects and canonical minutes", () => {
    expect(parseActivityLine("- {subjects: (rust, sürücü_belgesi), time: 150m} Açıklama."))
      .toEqual({ subjects: ["rust", "sürücü_belgesi"], minutes: 150, description: "Açıklama." });
  });

  it("parses zero-minute activities", () => {
    expect(parseActivityLine("- {subjects: (general), time: 0m} Later."))
      .toEqual({ subjects: ["general"], minutes: 0, description: "Later." });
  });

  it("rejects missing subjects and invalid identifiers", () => {
    expect(parseActivityLine("- {subjects: (), time: 30m} Empty.")).toBeNull();
    expect(parseActivityLine("- {subjects: (bad subject), time: 30m} Invalid.")).toBeNull();
  });

  it("accepts and retains legacy objective origin as compatibility metadata", () => {
    expect(parseObjectiveLine("- {subjects: (altyapı), origin: unplanned, status: partial} Beklenmeyen iş."))
      .toEqual({ subjects: ["altyapı"], legacyOrigin: "unplanned", status: "partial", description: "Beklenmeyen iş." });
  });

  it("accepts origin-free objectives and serializes legacy origin only when present", () => {
    const current = parseObjectiveLine("- {subjects: (rust), status: open} Current objective.");
    expect(current).toEqual({ subjects: ["rust"], status: "open", description: "Current objective." });
    expect(serializeObjectiveLine({ ...current, indent: 1 })).toBe("  - {subjects: (rust), status: open} Current objective.");
    expect(serializeObjectiveLine({ ...current, indent: 0, legacyOrigin: "planned" }))
      .toBe("- {subjects: (rust), origin: planned, status: open} Current objective.");
  });

  it("rejects invalid objective metadata", () => {
    expect(parseObjectiveLine("- {subjects: (rust), origin: accidental, status: open} Invalid origin.")).toBeNull();
    expect(parseObjectiveLine('- [ ] {subjects: (rust), goal: "Legacy"}')).toBeNull();
  });
});
