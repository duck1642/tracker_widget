import { summarizeDurations } from "$lib/shared/utils/durationSummary.ts";
import type { ActualDay, ActualEntry, PlanEntry } from "./types.ts";

export function aggregateWeeklyActual(plan: Pick<PlanEntry, "day" | "session">[], days: ActualDay[]): ActualEntry[] {
  const rows: ActualEntry[] = [];
  const bySession = new Map<string, ActualEntry & { activities: NonNullable<ActualEntry["activities"]> }>();
  for (const day of days) {
    for (const session of day.sessions) {
      const duration = summarizeDurations(session.activities.map((activity) => activity.minutes));
      if (duration.knownMinutes <= 0 && duration.unknownCount === 0) continue;
      const key = `${day.day.normalize("NFC").toLowerCase()}\0${session.name.normalize("NFC").toLowerCase()}`;
      let row = bySession.get(key);
      if (!row) {
        const planned = plan.find((entry) => entry.day.toLowerCase() === day.day.toLowerCase() && entry.session.normalize("NFC").toLowerCase() === session.name.normalize("NFC").toLowerCase());
        row = { day: day.day, session: planned?.session || session.name, subjects: [], actualMinutes: 0, activities: [] };
        rows.push(row);
        bySession.set(key, row);
      }
      row.actualMinutes += duration.knownMinutes;
      if (duration.unknownCount > 0) {
        row.unknownDurationCount = (row.unknownDurationCount || 0) + duration.unknownCount;
      }
      for (const activity of session.activities) {
        for (const subject of activity.subjects) if (!row.subjects.includes(subject)) row.subjects.push(subject);
        row.activities.push({
          description: activity.description,
          subjects: [...activity.subjects],
          minutes: activity.minutes
        });
      }
    }
  }
  return rows;
}
