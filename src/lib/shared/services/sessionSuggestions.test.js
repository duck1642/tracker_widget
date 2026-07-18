import { describe, expect, it } from "vitest";
import { buildSessionSuggestions } from "./sessionSuggestions.js";

describe("session suggestion builder", () => {
  it("places current-week sessions before usage-ranked history", () => {
    expect(buildSessionSuggestions({
      currentWeekSessions: ["Development", "Reading"],
      historicalSessions: ["Research", "Emergency repair"]
    })).toEqual([
      { name: "Development", plannedThisWeek: true },
      { name: "Reading", plannedThisWeek: true },
      { name: "Research", plannedThisWeek: false },
      { name: "Emergency repair", plannedThisWeek: false }
    ]);
  });

  it("deduplicates and excludes case-insensitively while preserving weekly casing", () => {
    expect(buildSessionSuggestions({
      currentWeekSessions: ["  Deep Work  ", "deep work"],
      historicalSessions: ["DEEP WORK", "Review", "Existing"],
      excludedSessions: ["existing"]
    })).toEqual([
      { name: "Deep Work", plannedThisWeek: true },
      { name: "Review", plannedThisWeek: false }
    ]);
  });
});
