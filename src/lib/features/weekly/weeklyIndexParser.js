// @ts-nocheck
import { createId, escapeTableCell, splitFrontmatter, splitTableRow } from "$lib/shared/parsers/markdownSections.js";
import { parseActivityLine, parseObjectiveLine, serializeActivityLine, serializeObjectiveLine } from "$lib/shared/parsers/inlineMetadata.js";

function section(body, name) {
  const heading = new RegExp(`^## ${name}\\s*$`, "mi").exec(body);
  if (!heading) return "";
  const start = heading.index + heading[0].length;
  const next = /^##\s+/gm;
  next.lastIndex = start;
  const following = next.exec(body);
  return body.slice(start, following?.index ?? body.length).replace(/^\n+|\n+$/g, "");
}

function preservedMarkdown(body) {
  const known = new Set(["objectives", "weekly plan", "weekly plan details", "weekly actual", "notes"]);
  const title = /^#\s+.+$/m.exec(body);
  const headings = [...body.matchAll(/^##\s+(.+)\s*$/gm)];
  const preambleStart = title ? title.index + title[0].length : 0;
  const preambleRaw = body.slice(preambleStart, headings[0]?.index ?? body.length).trim();
  const unknownSectionsRaw = headings.flatMap((heading, index) => {
    if (known.has(heading[1].trim().toLowerCase())) return [];
    const end = headings[index + 1]?.index ?? body.length;
    return [body.slice(heading.index, end).trim()];
  });
  return { preambleRaw, unknownSectionsRaw };
}

function parseMinutesCell(value) {
  return Math.max(0, Number(value) || 0);
}

function subjectsCell(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function planSummary(entry) {
  const activities = entry.activities || [];
  if (!activities.length) {
    return { subjects: ["general"], targetMinutes: 0 };
  }
  const subjects = [];
  const seen = new Set();
  let targetMinutes = 0;
  for (const activity of activities) {
    targetMinutes += activity.minutes || 0;
    for (const subject of activity.subjects || []) {
      const key = subject.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        subjects.push(subject);
      }
    }
  }
  return { subjects: subjects.length ? subjects : ["general"], targetMinutes };
}

function tableRows(content, type) {
  return content.split("\n").filter((line) => /^\|/.test(line)).slice(2).map(splitTableRow).filter((cells) => cells.length >= 4).map((cells, index) => {
    if (type === "plan") {
      const hasId = cells.length >= 5;
      return {
        id: hasId ? cells[0] : createId("plan", index),
        day: cells[hasId ? 1 : 0],
        session: cells[hasId ? 2 : 1],
        subjects: subjectsCell(cells[hasId ? 3 : 2]),
        targetMinutes: parseMinutesCell(cells[hasId ? 4 : 3]),
        activities: []
      };
    }
    return { day: cells[0], session: cells[1], subjects: subjectsCell(cells[2]), actualMinutes: parseMinutesCell(cells[3]) };
  });
}

function planDetails(body, plan) {
  const details = body.match(/<!-- tracker:plan-details:start -->([\s\S]*?)<!-- tracker:plan-details:end -->/)?.[1] || "";
  if (!details.trim()) return plan;
  const byId = new Map(plan.map((entry) => [entry.id, entry]));
  const headings = [...details.matchAll(/^###\s+(.+)\s*$/gm)];
  for (const [index, heading] of headings.entries()) {
    const id = heading[1].trim();
    const entry = byId.get(id);
    if (!entry) continue;
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? details.length;
    const content = details.slice(start, end);
    const activities = [];
    for (const line of content.split("\n")) {
      const activity = parseActivityLine(line);
      if (activity) activities.push({ id: createId(`plan-activity-${id}`, activities.length), ...activity });
    }
    entry.activities = activities;
  }
  return plan;
}

export function parseWeeklyIndex(markdown, isoWeek) {
  const { frontmatterRaw, body } = splitFrontmatter(markdown);
  const preserved = preservedMarkdown(body);
  const objectives = [];
  const objectiveRawLines = [];
  for (const line of section(body, "Objectives").split("\n")) {
    if (!line.trim()) continue;
    const objective = parseObjectiveLine(line);
    if (objective) objectives.push({ id: createId("objective", objectives.length), ...objective });
    else objectiveRawLines.push(line);
  }
  const plan = planDetails(body, tableRows(section(body, "Weekly Plan"), "plan"));
  const actualBlock = body.match(/<!-- tracker:actual:start -->([\s\S]*?)<!-- tracker:actual:end -->/)?.[1] || "";
  return { frontmatterRaw, ...preserved, isoWeek, objectives, objectiveRawLines, plan, actual: tableRows(actualBlock, "actual"), notesRaw: section(body, "Notes") };
}

function planTable(plan) {
  return ["| ID | Day | Session | Subjects | Target Minutes |", "| --- | --- | --- | --- | ---: |", ...plan.map((entry) => {
    const summary = planSummary(entry);
    return `| ${escapeTableCell(entry.id)} | ${escapeTableCell(entry.day)} | ${escapeTableCell(entry.session)} | ${escapeTableCell(summary.subjects.join(", "))} | ${summary.targetMinutes} |`;
  })].join("\n");
}

function planDetailsBlock(plan) {
  const blocks = [];
  for (const entry of plan) {
    const activities = entry.activities || [];
    if (!activities.length) continue;
    blocks.push(`### ${entry.id}\n\n${activities.map(serializeActivityLine).join("\n")}`);
  }
  const content = blocks.join("\n\n");
  return `<!-- tracker:plan-details:start -->${content ? `\n\n${content}\n\n` : "\n"}<!-- tracker:plan-details:end -->`;
}

function actualTable(actual) {
  return ["| Day | Session | Subjects | Actual Minutes |", "| --- | --- | --- | ---: |", ...actual.map((entry) => `| ${escapeTableCell(entry.day)} | ${escapeTableCell(entry.session)} | ${escapeTableCell(entry.subjects.join(", "))} | ${entry.actualMinutes} |`)].join("\n");
}

export function serializeWeeklyIndex(document) {
  const { year, week, rangeLabel = "" } = document.isoWeek;
  const blocks = [];
  if (document.frontmatterRaw) blocks.push(document.frontmatterRaw);
  blocks.push(`# ${year} - Week ${week} - ${rangeLabel}`.trim());
  if (document.preambleRaw) blocks.push(document.preambleRaw);
  blocks.push(...(document.unknownSectionsRaw || []));
  const objectiveContent = [...document.objectives.map(serializeObjectiveLine), ...(document.objectiveRawLines || [])].join("\n");
  blocks.push(`## Objectives\n\n${objectiveContent}`);
  blocks.push(`## Weekly Plan\n\n${planTable(document.plan)}`);
  blocks.push(`## Weekly Plan Details\n\n${planDetailsBlock(document.plan)}`);
  blocks.push(`## Weekly Actual\n\n<!-- tracker:actual:start -->\n${actualTable(document.actual)}\n<!-- tracker:actual:end -->`);
  blocks.push(`## Notes\n\n${document.notesRaw || ""}`);
  return `${blocks.join("\n\n")}\n`;
}
