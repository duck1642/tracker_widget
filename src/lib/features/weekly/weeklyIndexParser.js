// @ts-nocheck
import { createId, escapeTableCell, splitFrontmatter, splitTableRow } from "$lib/shared/parsers/markdownSections.js";
import { parseObjectiveLine, serializeObjectiveLine } from "$lib/shared/parsers/inlineMetadata.js";

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
  const known = new Set(["objectives", "weekly plan", "weekly actual", "notes"]);
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

function tableRows(content, type) {
  return content.split("\n").filter((line) => /^\|/.test(line)).slice(2).map(splitTableRow).filter((cells) => cells.length >= 4).map((cells, index) => type === "plan"
    ? { id: createId("plan", index), day: cells[0], session: cells[1], subjects: cells[2].split(",").map((item) => item.trim()).filter(Boolean), targetMinutes: Number(cells[3]) || 0 }
    : { day: cells[0], session: cells[1], subjects: cells[2].split(",").map((item) => item.trim()).filter(Boolean), actualMinutes: Number(cells[3]) || 0 });
}

export function parseWeeklyIndex(markdown, isoWeek) {
  const { frontmatterRaw, body } = splitFrontmatter(markdown);
  const preserved = preservedMarkdown(body);
  const objectives = section(body, "Objectives").split("\n").map(parseObjectiveLine).filter(Boolean).map((objective, index) => ({ id: createId("objective", index), ...objective }));
  const plan = tableRows(section(body, "Weekly Plan"), "plan");
  const actualBlock = body.match(/<!-- tracker:actual:start -->([\s\S]*?)<!-- tracker:actual:end -->/)?.[1] || "";
  return { frontmatterRaw, ...preserved, isoWeek, objectives, plan, actual: tableRows(actualBlock, "actual"), notesRaw: section(body, "Notes") };
}

function planTable(plan) {
  return ["| Day | Session | Subjects | Target Minutes |", "| --- | --- | --- | ---: |", ...plan.map((entry) => `| ${escapeTableCell(entry.day)} | ${escapeTableCell(entry.session)} | ${escapeTableCell(entry.subjects.join(", "))} | ${entry.targetMinutes} |`)].join("\n");
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
  blocks.push(`## Objectives\n\n${document.objectives.map(serializeObjectiveLine).join("\n")}`);
  blocks.push(`## Weekly Plan\n\n${planTable(document.plan)}`);
  blocks.push(`## Weekly Actual\n\n<!-- tracker:actual:start -->\n${actualTable(document.actual)}\n<!-- tracker:actual:end -->`);
  blocks.push(`## Notes\n\n${document.notesRaw || ""}`);
  return `${blocks.join("\n\n")}\n`;
}
