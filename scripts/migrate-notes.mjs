import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unwrapNoteContent, wrapNoteContent } from "../src/lib/shared/parsers/noteSection.js";

const WEEK_PATTERN = /^\d{4}w\d{2}$/;
const DAILY_LOG_PATTERN = /^\d{8}_log\.md$/;

function notesHeading(content) {
  const match = /^##[ \t]+Notes[ \t]*(\r\n|\n|\r|$)/im.exec(content);
  if (!match) return null;
  return {
    prefixEnd: match.index + match[0].length - match[1].length,
    tailStart: match.index + match[0].length
  };
}

export function migrateNoteContent(content) {
  const heading = notesHeading(content);
  if (!heading) return { status: "missing", content };

  const notes = unwrapNoteContent(content.slice(heading.tailStart));
  if (notes.malformed) return { status: "malformed", content };
  if (notes.wrapped) return { status: "already-wrapped", content };

  const eol = content.match(/\r\n|\n|\r/)?.[0] || "\n";
  const prefix = content.slice(0, heading.prefixEnd);
  const trailingEol = /(?:\r\n|\n|\r)$/.test(content) ? eol : "";
  return {
    status: "converted",
    content: `${prefix}${eol}${eol}${wrapNoteContent(notes.content, eol)}${trailingEol}`
  };
}

export async function findNoteFiles(rootPath) {
  const files = [];
  const rootEntries = await readdir(rootPath, { withFileTypes: true });
  for (const weekEntry of rootEntries) {
    if (!weekEntry.isDirectory() || !WEEK_PATTERN.test(weekEntry.name)) continue;
    const weekPath = path.join(rootPath, weekEntry.name);
    const entries = await readdir(weekPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name === `${weekEntry.name}_index.md` || DAILY_LOG_PATTERN.test(entry.name)) {
        files.push(path.join(weekPath, entry.name));
      }
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

function encodeUtf8(content, hasBom) {
  const prefix = hasBom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0);
  return Buffer.concat([prefix, Buffer.from(content, "utf8")]);
}

function timestamp(date) {
  const digits = date.toISOString().replace(/\D/g, "").slice(0, 14);
  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}

async function createBackupDirectory(rootPath, now) {
  const parent = path.join(rootPath, ".tracker-backups");
  await mkdir(parent, { recursive: true });
  const base = path.join(parent, `notes-${timestamp(now())}`);
  for (let suffix = 0; ; suffix += 1) {
    const candidate = suffix ? `${base}-${suffix}` : base;
    try {
      await mkdir(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
}

export async function runMigration(rootPath, { write = false, now = () => new Date() } = {}) {
  const absoluteRoot = path.resolve(rootPath);
  const files = await findNoteFiles(absoluteRoot);
  const counts = { converted: 0, alreadyWrapped: 0, malformed: 0, missing: 0 };
  const results = [];

  for (const filePath of files) {
    const original = await readFile(filePath);
    const decoded = decodeUtf8(original, filePath);
    const migration = migrateNoteContent(decoded.content);
    const countKey = migration.status === "already-wrapped" ? "alreadyWrapped" : migration.status;
    counts[countKey] += 1;
    results.push({
      path: filePath,
      relativePath: path.relative(absoluteRoot, filePath),
      status: migration.status,
      original,
      output: encodeUtf8(migration.content, decoded.hasBom)
    });
  }

  const converted = results.filter((result) => result.status === "converted");
  let backupPath = null;
  if (write && converted.length) {
    backupPath = await createBackupDirectory(absoluteRoot, now);
    for (const result of converted) {
      const backupFile = path.join(backupPath, result.relativePath);
      await mkdir(path.dirname(backupFile), { recursive: true });
      await writeFile(backupFile, result.original);
    }
    for (const result of converted) {
      await writeFile(result.path, result.output);
    }
  }

  return {
    rootPath: absoluteRoot,
    write,
    scannedFiles: files.length,
    counts,
    backupPath,
    files: results.map(({ relativePath, status }) => ({ relativePath, status }))
  };
}

export function formatReport(report) {
  const lines = [
    `Mode: ${report.write ? "WRITE" : "DRY RUN"}`,
    `Workspace: ${report.rootPath}`,
    `Note files scanned: ${report.scannedFiles}`,
    `Legacy files to convert: ${report.counts.converted}`,
    `Already wrapped: ${report.counts.alreadyWrapped}`,
    `Malformed (skipped): ${report.counts.malformed}`,
    `Missing Notes section: ${report.counts.missing}`
  ];
  for (const file of report.files.filter((entry) => entry.status === "converted" || entry.status === "malformed")) {
    lines.push(`- ${file.relativePath}: ${file.status}`);
  }
  if (report.backupPath) lines.push(`Backup: ${report.backupPath}`);
  if (!report.write && report.counts.converted) lines.push("No files changed. Review this report, then re-run with --write.");
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const positional = args.filter((argument) => argument !== "--write");
  if (positional.length !== 1) {
    console.error("Usage: node scripts/migrate-notes.mjs <workspace> [--write]");
    process.exitCode = 2;
    return;
  }
  console.log(formatReport(await runMigration(positional[0], { write })));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}
