// @ts-nocheck

function normalizedName(value) {
  return value.trim().normalize("NFC").toLocaleLowerCase();
}

export function buildSessionSuggestions({ currentWeekSessions = [], historicalSessions = [], excludedSessions = [] } = {}) {
  const excluded = new Set(excludedSessions.map(normalizedName).filter(Boolean));
  const seen = new Set();
  const suggestions = [];

  function append(names, plannedThisWeek) {
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
