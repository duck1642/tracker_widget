// @ts-nocheck

export function summarizeDurations(values) {
  let knownMinutes = 0;
  let unknownCount = 0;
  for (const value of values) {
    if (value === null) {
      unknownCount += 1;
    } else {
      knownMinutes += Math.max(0, Number(value) || 0);
    }
  }
  return { knownMinutes, unknownCount };
}

export function formatDurationSummary(summary, { hours = false } = {}) {
  const knownMinutes = Math.max(0, Number(summary?.knownMinutes) || 0);
  const unknownCount = Math.max(0, Number(summary?.unknownCount) || 0);
  if (knownMinutes === 0 && unknownCount > 0) return "?";
  const wholeHours = Math.floor(knownMinutes / 60);
  const remainingMinutes = knownMinutes % 60;
  const value = hours
    ? wholeHours > 0
      ? `${wholeHours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ""}`
      : `${remainingMinutes}m`
    : `${knownMinutes}m`;
  return unknownCount > 0 ? `${value}+` : value;
}

export function parseDurationCell(value) {
  const normalized = String(value ?? "").trim();
  if (normalized === "?") return { knownMinutes: 0, unknownCount: 1 };
  const incomplete = /^(\d+)\+$/.exec(normalized);
  if (incomplete) return { knownMinutes: Number(incomplete[1]), unknownCount: 1 };
  return { knownMinutes: Math.max(0, Number(normalized) || 0), unknownCount: 0 };
}

export function formatDurationCell(summary) {
  const knownMinutes = Math.max(0, Number(summary?.knownMinutes) || 0);
  const unknownCount = Math.max(0, Number(summary?.unknownCount) || 0);
  if (knownMinutes === 0 && unknownCount > 0) return "?";
  return `${knownMinutes}${unknownCount > 0 ? "+" : ""}`;
}
