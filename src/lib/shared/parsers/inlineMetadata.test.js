import { describe, expect, it } from "vitest";
import { parseActivityLine, parseObjectiveLine } from "./inlineMetadata.js";

describe("inline metadata", () => {
  it("parses Unicode subjects and canonical minutes", () => {
    expect(parseActivityLine("- {subjects: (rust, sürücü_belgesi), time: 150m} Açıklama."))
      .toEqual({ subjects: ["rust", "sürücü_belgesi"], minutes: 150, description: "Açıklama." });
  });

  it("rejects missing subjects and invalid identifiers", () => {
    expect(parseActivityLine("- {subjects: (), time: 30m} Empty.")).toBeNull();
    expect(parseActivityLine("- {subjects: (bad subject), time: 30m} Invalid.")).toBeNull();
  });

  it("parses objective origin and status independently", () => {
    expect(parseObjectiveLine("- {subjects: (altyapı), origin: unplanned, status: partial} Beklenmeyen iş."))
      .toEqual({ subjects: ["altyapı"], origin: "unplanned", status: "partial", description: "Beklenmeyen iş." });
  });
});
