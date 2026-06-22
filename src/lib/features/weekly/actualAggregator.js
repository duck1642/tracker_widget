// @ts-nocheck
export function aggregateWeeklyActual(plan, days) {
  const rows = [];
  const bySession = new Map();
  for (const day of days) {
    for (const session of day.sessions) {
      const minutes = session.activities.reduce((sum, activity) => sum + activity.minutes, 0);
      if (minutes <= 0) continue;
      const key = `${day.day.normalize("NFC").toLowerCase()}\0${session.name.normalize("NFC").toLowerCase()}`;
      let row = bySession.get(key);
      if (!row) {
        const planned = plan.find((entry) => entry.day.toLowerCase() === day.day.toLowerCase() && entry.session.normalize("NFC").toLowerCase() === session.name.normalize("NFC").toLowerCase());
        row = { day: day.day, session: planned?.session || session.name, subjects: [], actualMinutes: 0, plannedIndex: planned ? plan.indexOf(planned) : Number.MAX_SAFE_INTEGER, sourceIndex: rows.length };
        rows.push(row);
        bySession.set(key, row);
      }
      row.actualMinutes += minutes;
      for (const activity of session.activities) {
        for (const subject of activity.subjects) if (!row.subjects.includes(subject)) row.subjects.push(subject);
      }
    }
  }
  return rows.sort((a, b) => a.plannedIndex - b.plannedIndex || a.sourceIndex - b.sourceIndex).map(({ plannedIndex, sourceIndex, ...row }) => row);
}
