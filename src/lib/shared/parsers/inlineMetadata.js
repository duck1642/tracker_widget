// @ts-nocheck
const SUBJECT_PATTERN = /^[\p{L}\p{N}_-]+$/u;
const ORIGINS = new Set(["planned", "unplanned"]);
const STATUSES = new Set(["open", "done", "partial", "cancelled"]);

function parseSubjects(metadata) {
  const match = metadata.match(/(?:^|,\s*)subjects:\s*\(([^)]*)\)/u);
  if (!match) return null;
  const subjects = match[1].split(",").map((item) => item.trim().normalize("NFC")).filter(Boolean);
  return subjects.length > 0 && subjects.every((subject) => SUBJECT_PATTERN.test(subject))
    ? subjects
    : null;
}

function splitLine(line) {
  const match = line.match(/^-\s+\{([^}]*)\}\s+(.+)$/u);
  return match ? { metadata: match[1], description: match[2].normalize("NFC") } : null;
}

export function parseActivityLine(line) {
  const parts = splitLine(line);
  if (!parts) return null;
  const subjects = parseSubjects(parts.metadata);
  const time = parts.metadata.match(/(?:^|,\s*)time:\s*(\d+)m(?:$|,)/u);
  if (!subjects || !time || Number(time[1]) < 0) return null;
  return { subjects, minutes: Number(time[1]), description: parts.description };
}

export function serializeActivityLine(activity) {
  return `- {subjects: (${activity.subjects.join(", ")}), time: ${activity.minutes}m} ${activity.description}`;
}

export function parseObjectiveLine(line) {
  const parts = splitLine(line);
  if (!parts) return null;
  const subjects = parseSubjects(parts.metadata);
  const origin = parts.metadata.match(/(?:^|,\s*)origin:\s*([\p{L}-]+)(?:$|,)/u)?.[1];
  const status = parts.metadata.match(/(?:^|,\s*)status:\s*([\p{L}-]+)(?:$|,)/u)?.[1];
  if (!subjects || !ORIGINS.has(origin) || !STATUSES.has(status)) return null;
  return { subjects, origin, status, description: parts.description };
}

export function serializeObjectiveLine(objective) {
  return `- {subjects: (${objective.subjects.join(", ")}), origin: ${objective.origin}, status: ${objective.status}} ${objective.description}`;
}

export function isValidSubject(subject) {
  return SUBJECT_PATTERN.test(subject.normalize("NFC"));
}
