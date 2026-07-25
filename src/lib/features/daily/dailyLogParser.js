// @ts-nocheck
import { createId, splitFrontmatter } from "$lib/shared/parsers/markdownSections.js";
import { parseActivityLine, serializeActivityLine } from "$lib/shared/parsers/inlineMetadata.js";
import { splitTerminalNotes, wrapNoteContent } from "$lib/shared/parsers/noteSection.js";

const RESERVED = new Set(["notes", "total time"]);

export function parseDailyLog(markdown, fallbackDate = "") {
  const { frontmatterRaw, body } = splitFrontmatter(markdown);
  const notes = splitTerminalNotes(body);
  const documentBody = notes.documentBody;
  const title = /^#\s+(\d{4}-\d{2}-\d{2})\s*$/m.exec(documentBody);
  const date = title?.[1] || fallbackDate;
  const headings = [...documentBody.matchAll(/^##\s+(.+)\s*$/gm)];
  const preambleStart = title ? title.index + title[0].length : 0;
  const preambleEnd = headings[0]?.index ?? documentBody.length;
  const preambleRaw = documentBody.slice(preambleStart, preambleEnd).trim();
  const sessions = [];

  headings.forEach((heading, index) => {
    const name = heading[1].trim().normalize("NFC");
    const start = heading.index + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : documentBody.length;
    const content = documentBody.slice(start, end).replace(/^\n+|\n+$/g, "");
    if (!RESERVED.has(name.toLowerCase())) {
      const activities = [];
      const rawLines = [];
      for (const line of content.split("\n")) {
        const activity = parseActivityLine(line);
        if (activity) activities.push({ id: createId(`activity-${sessions.length}`, activities.length), ...activity });
        else if (line.trim()) rawLines.push(line);
      }
      sessions.push({ id: createId("session", sessions.length), name, activities, rawLines });
    }
  });

  const totalMinutes = sessions.reduce((total, session) => total + session.activities.reduce((sum, activity) => sum + activity.minutes, 0), 0);
  return { frontmatterRaw, preambleRaw, date, sessions, totalMinutes, notesRaw: notes.notesRaw };
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
  blocks.push(`---\n\n## Notes\n\n${wrapNoteContent(document.notesRaw || "")}`);
  return `${blocks.join("\n\n")}\n`;
}
