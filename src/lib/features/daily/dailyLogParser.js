// @ts-nocheck
import { createId, splitFrontmatter } from "$lib/shared/parsers/markdownSections.js";
import { isValidSubject, parseActivityLine, serializeActivityLine } from "$lib/shared/parsers/inlineMetadata.js";

const RESERVED = new Set(["notes", "total time"]);

function legacyMinutes(value) {
  const hours = Number(value.match(/(\d+)\s*h/i)?.[1] || 0);
  const minutes = Number(value.match(/(\d+)\s*(?:min|m)\b/i)?.[1] || 0);
  return hours * 60 + minutes;
}

export function parseLegacySessionActivities(content) {
  if (!/\*\*subjects:\*\*/i.test(content)) return null;
  const subjectsBlock = content.match(/\*\*subjects:\*\*([\s\S]*?)(?=\*\*time:\*\*)/i)?.[1] || "";
  const timesBlock = content.match(/\*\*time:\*\*([\s\S]*?)(?=\*\*details:\*\*)/i)?.[1] || "";
  const detailsBlock = content.match(/\*\*details:\*\*([\s\S]*?)(?=\n---|$)/i)?.[1] || "";
  const subjectRows = [...subjectsBlock.matchAll(/^\s*-\s+(.+)$/gm)].map((match) => match[1].trim());
  const times = [...timesBlock.matchAll(/^\s*-\s+(.+)$/gm)].map((match) => legacyMinutes(match[1]));
  const details = [...detailsBlock.matchAll(/^\s*-\s+(.+)$/gm)].map((match) => match[1].trim());
  if (!subjectRows.length && !times.length && !details.length) return [];
  if (subjectRows.length !== times.length || (details.length !== subjectRows.length && subjectRows.length !== 1)) return null;
  const activities = subjectRows.map((row, index) => {
    const subjects = row.split(",").map((subject) => subject.trim().normalize("NFC")).filter(Boolean);
    if (!subjects.length || subjects.some((subject) => !isValidSubject(subject)) || times[index] <= 0) return null;
    return {
      subjects,
      minutes: times[index],
      description: subjectRows.length === 1 ? details.join(" ") : details[index]
    };
  });
  return activities.some((activity) => !activity) ? null : activities;
}

export function parseDailyLog(markdown, fallbackDate = "") {
  const { frontmatterRaw, body } = splitFrontmatter(markdown);
  const title = /^#\s+(\d{4}-\d{2}-\d{2})\s*$/m.exec(body);
  const date = title?.[1] || fallbackDate;
  const headings = [...body.matchAll(/^##\s+(.+)\s*$/gm)];
  const preambleStart = title ? title.index + title[0].length : 0;
  const preambleEnd = headings[0]?.index ?? body.length;
  const preambleRaw = body.slice(preambleStart, preambleEnd).trim();
  const sessions = [];
  let notesRaw = "";

  headings.forEach((heading, index) => {
    const name = heading[1].trim().normalize("NFC");
    const start = heading.index + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : body.length;
    const content = body.slice(start, end).replace(/^\n+|\n+$/g, "");
    if (name.toLowerCase() === "notes") {
      notesRaw = content;
    } else if (!RESERVED.has(name.toLowerCase())) {
      const activities = [];
      const rawLines = [];
      for (const line of content.split("\n")) {
        const activity = parseActivityLine(line);
        if (activity) activities.push({ id: createId(`activity-${sessions.length}`, activities.length), ...activity });
        else if (line.trim()) rawLines.push(line);
      }
      const legacyActivities = activities.length === 0 ? parseLegacySessionActivities(content) : null;
      if (legacyActivities) {
        activities.push(...legacyActivities.map((activity, activityIndex) => ({ id: createId(`legacy-activity-${sessions.length}`, activityIndex), ...activity })));
        rawLines.length = 0;
      } else if (Array.isArray(legacyActivities) && legacyActivities.length === 0) {
        rawLines.length = 0;
      }
      sessions.push({ id: createId("session", sessions.length), name, activities, rawLines });
    }
  });

  const totalMinutes = sessions.reduce((total, session) => total + session.activities.reduce((sum, activity) => sum + activity.minutes, 0), 0);
  return { frontmatterRaw, preambleRaw, date, sessions, totalMinutes, notesRaw };
}

export function serializeDailyLog(document) {
  const blocks = [];
  if (document.frontmatterRaw) blocks.push(document.frontmatterRaw);
  blocks.push(`# ${document.date}`);
  if (document.preambleRaw) blocks.push(document.preambleRaw);
  for (const session of document.sessions) {
    const content = [...session.activities.map(serializeActivityLine), ...(session.rawLines || [])].join("\n");
    blocks.push(`## ${session.name}${content ? `\n\n${content}` : ""}`);
  }
  const total = document.sessions.reduce((sum, session) => sum + session.activities.reduce((inner, activity) => inner + activity.minutes, 0), 0);
  blocks.push(`## Total Time\n\n${total}m`);
  blocks.push(`---\n\n## Notes\n\n${document.notesRaw || "-"}`);
  return `${blocks.join("\n\n")}\n`;
}
