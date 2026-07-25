import { describe, expect, it } from "vitest";
import {
  formatDurationCell,
  formatDurationSummary,
  parseDurationCell,
  summarizeDurations
} from "./durationSummary.js";

describe("duration summaries", () => {
  it("keeps known zero distinct from unknown durations", () => {
    expect(summarizeDurations([0, 30, null])).toEqual({ knownMinutes: 30, unknownCount: 1 });
    expect(summarizeDurations([0])).toEqual({ knownMinutes: 0, unknownCount: 0 });
  });

  it("formats complete, mixed, and wholly unknown totals", () => {
    expect(formatDurationSummary({ knownMinutes: 90, unknownCount: 0 })).toBe("90m");
    expect(formatDurationSummary({ knownMinutes: 90, unknownCount: 2 })).toBe("90m+");
    expect(formatDurationSummary({ knownMinutes: 0, unknownCount: 2 })).toBe("?");
    expect(formatDurationSummary({ knownMinutes: 100, unknownCount: 1 }, { hours: true })).toBe("1h 40m+");
  });

  it("round trips incomplete duration table cells", () => {
    expect(parseDurationCell("90")).toEqual({ knownMinutes: 90, unknownCount: 0 });
    expect(parseDurationCell("90+")).toEqual({ knownMinutes: 90, unknownCount: 1 });
    expect(parseDurationCell("?")).toEqual({ knownMinutes: 0, unknownCount: 1 });
    expect(formatDurationCell({ knownMinutes: 90, unknownCount: 1 })).toBe("90+");
    expect(formatDurationCell({ knownMinutes: 0, unknownCount: 1 })).toBe("?");
  });
});
