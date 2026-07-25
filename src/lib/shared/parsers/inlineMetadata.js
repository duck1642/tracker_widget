// @ts-nocheck
const SUBJECT_PATTERN = /^[\p{L}\p{N}_-]+$/u;
const STATUSES = new Set(["open", "done", "partial", "cancelled"]);

function parseSubjects(metadata) {
  const match = metadata.match(/(?:^|,\s*)subjects:\s*\(([^)]*)\)/u);
  if (!match) return null;
  const subjects = match[1].split(",").map((item) => item.trim().normalize("NFC")).filter(Boolean);
  return subjects.length > 0 && subjects.every((subject) => SUBJECT_PATTERN.test(subject))
    ? subjects
    : null;
}

function splitLine(line, { allowEmptyDescription = false } = {}) {
  const pattern = allowEmptyDescription
    ? /^-\s+\{([^}]*)\}(?:\s+(.*))?$/u
    : /^-\s+\{([^}]*)\}\s+(.+)$/u;
  const match = line.match(pattern);
  return match ? { metadata: match[1], description: (match[2] || "").normalize("NFC") } : null;
}

export function parseActivityLine(line) {
  const parts = splitLine(line, { allowEmptyDescription: true });
  if (!parts) return null;
  const subjects = parseSubjects(parts.metadata);
  const time = parts.metadata.match(/(?:^|,\s*)time:\s*(?:(\d+)m|(\?))(?:$|,)/u);
  if (!subjects || !time) return null;
  return { subjects, minutes: time[2] ? null : Number(time[1]), description: parts.description };
}

export function serializeActivityLine(activity) {
  const duration = activity.minutes === null ? "?" : `${activity.minutes}m`;
  const metadata = `- {subjects: (${activity.subjects.join(", ")}), time: ${duration}}`;
  return activity.description ? `${metadata} ${activity.description}` : metadata;
}

export function parseObjectiveLine(line) {
  const parts = splitLine(line, { allowEmptyDescription: true });
  if (!parts) return null;
  const metadataKeys = [...parts.metadata.matchAll(/(?:^|,\s*)([\p{L}-]+):/gu)].map((match) => match[1]);
  if (metadataKeys.some((key) => !["subjects", "status"].includes(key))) return null;
  const subjects = parseSubjects(parts.metadata);
  const status = parts.metadata.match(/(?:^|,\s*)status:\s*([\p{L}-]+)(?:$|,)/u)?.[1];
  if (!subjects || !STATUSES.has(status)) return null;
  return { subjects, status, description: parts.description };
}

export function serializeObjectiveLine(objective) {
  const indent = "  ".repeat(Math.max(0, Number(objective.indent) || 0));
  const metadata = `${indent}- {subjects: (${objective.subjects.join(", ")}), status: ${objective.status}}`;
  return objective.description ? `${metadata} ${objective.description}` : metadata;
}

export function isValidSubject(subject) {
  return SUBJECT_PATTERN.test(subject.normalize("NFC"));
}
