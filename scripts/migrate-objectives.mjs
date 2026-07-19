import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEEK_PATTERN = /^\d{4}w\d{2}$/;
const SUBJECT_PATTERN = /^[\p{L}\p{N}_-]+$/u;
const VALID_STATUSES = new Set(["open", "done", "partial", "cancelled"]);
const LEGACY_ORIGIN_PATTERN = /(?:^|,\s*)origin:\s*(planned|unplanned)(?=\s*(?:,|$))/u;

function validObjectiveMetadata(metadata) {
  const keys = [...metadata.matchAll(/(?:^|,\s*)([\p{L}-]+):/gu)].map((match) => match[1]);
  if (keys.some((key) => !["subjects", "origin", "status"].includes(key))) return false;
  const subjectsMatch = metadata.match(/(?:^|,\s*)subjects:\s*\(([^)]*)\)/u);
  const status = metadata.match(/(?:^|,\s*)status:\s*([\p{L}-]+)(?:$|,)/u)?.[1];
  if (!subjectsMatch || !VALID_STATUSES.has(status)) return false;
  const subjects = subjectsMatch[1].split(",").map((value) => value.trim()).filter(Boolean);
  return subjects.length > 0 && subjects.every((subject) => SUBJECT_PATTERN.test(subject));
}

function removeLegacyOrigin(metadata) {
  const match = metadata.match(LEGACY_ORIGIN_PATTERN);
  if (!match) return null;
  if (match.index === 0) {
    return {
      metadata: metadata.replace(/^origin:\s*(?:planned|unplanned)\s*,\s*/u, ""),
      origin: match[1]
    };
  }
  return {
    metadata: metadata.replace(/,\s*origin:\s*(?:planned|unplanned)\s*(?=,|$)/u, ""),
    origin: match[1]
  };
}

export function migrateObjectiveContent(content) {
  let inObjectives = false;
  let changed = false;
  const counts = { planned: 0, unplanned: 0 };
  const output = content.replace(/[^\r\n]*(?:\r\n|\n|\r|$)/g, (rawLine) => {
    if (!rawLine) return rawLine;
    const ending = rawLine.match(/\r\n|\n|\r$/)?.[0] || "";
    const line = ending ? rawLine.slice(0, -ending.length) : rawLine;
    if (/^##\s+Objectives\s*$/iu.test(line)) {
      inObjectives = true;
      return rawLine;
    }
    if (/^##\s+/u.test(line)) {
      inObjectives = false;
      return rawLine;
    }
    if (!inObjectives) return rawLine;

    const objective = line.match(/^([ \t]*)(-\s+\{)([^}]*)(\}(?:\s+.*)?)$/u);
    if (!objective) return rawLine;
    const spaces = [...objective[1]].reduce((total, character) => total + (character === "\t" ? 2 : 1), 0);
    if (spaces % 2 !== 0 || spaces / 2 > 2 || !validObjectiveMetadata(objective[3])) return rawLine;
    const migrated = removeLegacyOrigin(objective[3]);
    if (!migrated) return rawLine;

    changed = true;
    counts[migrated.origin] += 1;
    return `${objective[1]}${objective[2]}${migrated.metadata}${objective[4]}${ending}`;
  });
  return { content: output, changed, counts, total: counts.planned + counts.unplanned };
}

export async function findWeeklyIndexFiles(rootPath) {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !WEEK_PATTERN.test(entry.name)) continue;
    const indexPath = path.join(rootPath, entry.name, `${entry.name}_index.md`);
    try {
      const statEntries = await readdir(path.dirname(indexPath));
      if (statEntries.includes(path.basename(indexPath))) files.push(indexPath);
    } catch {
      // A disappearing or unreadable week folder is surfaced by the final scan results.
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function decodeUtf8(buffer, filePath) {
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const bytes = hasBom ? buffer.subarray(3) : buffer;
  try {
    return { content: new TextDecoder("utf-8", { fatal: true }).decode(bytes), hasBom };
  } catch {
    throw new Error(`Not valid UTF-8: ${filePath}`);
  }
}

export async function runMigration(rootPath, { write = false } = {}) {
  const absoluteRoot = path.resolve(rootPath);
  const files = await findWeeklyIndexFiles(absoluteRoot);
  const affected = [];
  const totals = { planned: 0, unplanned: 0 };
  for (const filePath of files) {
    const original = await readFile(filePath);
    const decoded = decodeUtf8(original, filePath);
    const result = migrateObjectiveContent(decoded.content);
    if (!result.changed) continue;
    affected.push({
      path: filePath,
      relativePath: path.relative(absoluteRoot, filePath),
      total: result.total,
      counts: result.counts
    });
    totals.planned += result.counts.planned;
    totals.unplanned += result.counts.unplanned;
    if (write) {
      const prefix = decoded.hasBom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0);
      await writeFile(filePath, Buffer.concat([prefix, Buffer.from(result.content, "utf8")]));
    }
  }
  return { rootPath: absoluteRoot, write, scannedFiles: files.length, affected, totals, total: totals.planned + totals.unplanned };
}

export function formatReport(report) {
  const lines = [
    `Mode: ${report.write ? "WRITE" : "DRY RUN"}`,
    `Workspace: ${report.rootPath}`,
    `Weekly indexes scanned: ${report.scannedFiles}`,
    `Affected files: ${report.affected.length}`,
    `Legacy objectives: ${report.total} (planned: ${report.totals.planned}, unplanned: ${report.totals.unplanned})`
  ];
  for (const file of report.affected) {
    lines.push(`- ${file.relativePath}: ${file.total}`);
  }
  if (!report.write && report.total > 0) lines.push("No files changed. Re-run with --write after creating a backup.");
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const positional = args.filter((argument) => argument !== "--write");
  if (positional.length !== 1) {
    console.error("Usage: node scripts/migrate-objectives.mjs <logs-root> [--write]");
    process.exitCode = 2;
    return;
  }
  const report = await runMigration(positional[0], { write });
  console.log(formatReport(report));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}
