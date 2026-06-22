// @ts-nocheck
import { serializeDailyLog } from "$lib/features/daily/dailyLogParser.js";
import { splitFrontmatter } from "$lib/shared/parsers/markdownSections.js";
import { serializeWeeklyIndex } from "$lib/features/weekly/weeklyIndexParser.js";
import { splitTableRow } from "$lib/shared/parsers/markdownSections.js";

function parseLegacyMinutes(value) {
  return Number(value.match(/(\d+)\s*(?:min|m)/)?.[1] || 0);
}

function legacySection(body, name) {
  const heading = new RegExp(`^## ${name}\\s*$`, "mi").exec(body);
  if (!heading) return "";
  const start = heading.index + heading[0].length;
  const next = /^##\s+/gm;
  next.lastIndex = start;
  const following = next.exec(body);
  return body.slice(start, following?.index ?? body.length).trim();
}

export function planLegacyDailyMigration(markdown, date) {
  const hasLegacyBlocks = /\*\*(?:subjects|time|details):\*\*/i.test(markdown);
  const hasCanonicalActivity = /^- \{subjects: \([^)]*\), time: \d+m\}/m.test(markdown);
  const hasCanonicalTotal = /^## Total Time\s*$[\s\S]*?^\d+m\s*$/m.test(markdown);
  if (!hasLegacyBlocks && (hasCanonicalActivity || hasCanonicalTotal)) return { status: "current", output: markdown, issues: [] };
  if (hasLegacyBlocks && hasCanonicalActivity) return { status: "ambiguous", output: null, issues: ["File mixes current and legacy activity formats"] };
  const { frontmatterRaw, body } = splitFrontmatter(markdown);
  const headings = [...body.matchAll(/^##\s+(.+)\s*$/gm)];
  const sessions = [];
  const issues = [];
  let notesRaw = "";
  headings.forEach((heading, index) => {
    const name = heading[1].trim();
    const start = heading.index + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : body.length;
    const content = body.slice(start, end);
    if (name.toLowerCase() === "notes") {
      notesRaw = content.replace(/^\s+|\s+$/g, "");
      return;
    }
    if (name.toLowerCase() === "total time") return;
    const subjectsBlock = content.match(/\*\*subjects:\*\*([\s\S]*?)(?=\*\*time:)/i)?.[1] || "";
    const timesBlock = content.match(/\*\*time:\*\*([\s\S]*?)(?=\*\*details:)/i)?.[1] || "";
    const detailsBlock = content.match(/\*\*details:\*\*([\s\S]*?)(?=\n---|$)/i)?.[1] || "";
    const subjects = [...subjectsBlock.matchAll(/^\s*-\s+(.+)$/gm)].map((match) => match[1].trim());
    const times = [...timesBlock.matchAll(/^\s*-\s+(.+)$/gm)].map((match) => parseLegacyMinutes(match[1]));
    const details = [...detailsBlock.matchAll(/^\s*-\s+(.+)$/gm)].map((match) => match[1].trim());
    if (subjects.length === 0 && times.length === 0 && details.length === 0) return;
    if (subjects.length !== times.length || (details.length !== subjects.length && subjects.length !== 1)) {
      issues.push(`${name}: parallel list counts do not align`);
      return;
    }
    const activities = subjects.map((subject, activityIndex) => ({
      id: `legacy-${index}-${activityIndex}`,
      subjects: [subject.normalize("NFC")],
      minutes: times[activityIndex],
      description: subjects.length === 1 ? details.join(" ") : details[activityIndex]
    }));
    sessions.push({ id: `legacy-session-${index}`, name, activities });
  });
  if (issues.length) return { status: "ambiguous", output: null, issues };
  return { status: "migratable", issues: [], output: serializeDailyLog({ frontmatterRaw, date, sessions, notesRaw }) };
}

export function planLegacyWeeklyMigration(markdown, isoWeek) {
  if (/^## Weekly Plan\s*$/m.test(markdown) && /<!-- tracker:actual:start -->[\s\S]*<!-- tracker:actual:end -->/m.test(markdown)) return { status: "current", output: markdown, issues: [] };
  const { frontmatterRaw, body } = splitFrontmatter(markdown);
  const objectivesBlock = legacySection(body, "Objectives");
  const objectives = [...objectivesBlock.matchAll(/^- \[([ xX])\] \{subjects:\s*\(([^)]*)\),\s*goal:\s*"([\s\S]*?)"\}\s*$/gm)].map((match, index) => ({
    id: `legacy-objective-${index}`,
    subjects: match[2].split(",").map((item) => item.trim()).filter(Boolean),
    origin: "planned",
    status: match[1].toLowerCase() === "x" ? "done" : "open",
    description: match[3]
  }));
  const planBlock = legacySection(body, "Plan");
  const rows = planBlock.split("\n").filter((line) => /^\|/.test(line)).map(splitTableRow);
  const headers = rows[0] || [];
  const targetIndex = headers.findIndex((header) => /target hours/i.test(header));
  const issues = [];
  const plan = [];
  rows.slice(2).forEach((cells, rowIndex) => {
    headers.forEach((header, columnIndex) => {
      if (columnIndex === 0 || columnIndex === targetIndex || !cells[columnIndex]?.trim()) return;
      plan.push({ id: `legacy-plan-${rowIndex}-${columnIndex}`, day: cells[0], session: header, subjects: cells[columnIndex].split(",").map((item) => item.trim()).filter(Boolean), targetMinutes: 0 });
    });
  });
  if (issues.length) return { status: "ambiguous", output: null, issues };
  const notesRaw = legacySection(body, "Notes");
  return { status: "migratable", issues: [], output: serializeWeeklyIndex({ frontmatterRaw, isoWeek, objectives, plan, actual: [], notesRaw }) };
}
