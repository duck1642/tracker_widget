
import type { SessionSuggestion } from "./types.ts";

function normalizedName(value: string) {
  return value.trim().normalize("NFC").toLocaleLowerCase();
}


export function buildSessionSuggestions({ currentWeekSessions = [], historicalSessions = [], excludedSessions = [] }: {


    currentWeekSessions?: string[];


    historicalSessions?: string[];


    excludedSessions?: string[];


} = {}): { name: string, plannedThisWeek: boolean }[] {
  const excluded = new Set(excludedSessions.map(normalizedName).filter(Boolean));
  const seen = new Set();
  const suggestions: SessionSuggestion[] = [];

  function append(names: string[], plannedThisWeek: boolean) {
    for (const value of names) {
      const name = value.trim().normalize("NFC");
      const key = normalizedName(name);
      if (!key || excluded.has(key) || seen.has(key)) continue;
      seen.add(key);
      suggestions.push({ name, plannedThisWeek });
    }
  }

  append(currentWeekSessions, true);
  append(historicalSessions, false);
  return suggestions;
}
