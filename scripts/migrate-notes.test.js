import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findNoteFiles, migrateNoteContent, runMigration } from "./migrate-notes.mjs";

const temporaryRoots = [];

async function temporaryWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), "tracker-notes-migration-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("notes migration", () => {
  it("wraps only the terminal Notes tail while preserving its prefix and line endings", () => {
    const prefix = "# Week\r\n\r\n## Objectives\r\n\r\n- Item\r\n\r\n## Notes";
    const input = `${prefix}\r\n\r\n# Note title\r\n\r\n\`\`\`\`text\r\ninner\r\n\`\`\`\`\r\n`;
    const result = migrateNoteContent(input);

    expect(result.status).toBe("converted");
    expect(result.content.startsWith(`${prefix}\r\n\r\n\`\`\`\`\`tracker-notes\r\n`)).toBe(true);
    expect(result.content).toContain("# Note title\r\n\r\n````text\r\ninner\r\n````\r\n`````");
    expect(result.content.endsWith("`````\r\n")).toBe(true);
    expect(migrateNoteContent(result.content)).toMatchObject({ status: "already-wrapped", content: result.content });
  });

  it("does not rewrite missing or malformed Notes sections", () => {
    const missing = "# Week\n\n## Objectives\n";
    expect(migrateNoteContent(missing)).toEqual({ status: "missing", content: missing });

    const malformed = "# Day\n\n## Notes\n\n````tracker-notes\n# Unclosed";
    expect(migrateNoteContent(malformed)).toEqual({ status: "malformed", content: malformed });
  });

  it("finds only canonical daily logs and weekly indexes", async () => {
    const root = await temporaryWorkspace();
    const week = path.join(root, "2026w03");
    await mkdir(week);
    await Promise.all([
      writeFile(path.join(week, "2026w03_index.md"), "index"),
      writeFile(path.join(week, "20260115_log.md"), "daily"),
      writeFile(path.join(week, "20260115.md"), "other"),
      writeFile(path.join(week, "other_log.md"), "other"),
      writeFile(path.join(week, "2026w04_index.md"), "wrong week")
    ]);

    expect(await findNoteFiles(root)).toEqual([
      path.join(week, "20260115_log.md"),
      path.join(week, "2026w03_index.md")
    ]);
  });

  it("defaults to dry-run, then backs up originals before writing and preserves BOM", async () => {
    const root = await temporaryWorkspace();
    const week = path.join(root, "2026w04");
    const dailyPath = path.join(week, "20260122_log.md");
    await mkdir(week);
    const original = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("# Day\r\n\r\n## Notes\r\n\r\n# Heading\r\n")
    ]);
    await writeFile(dailyPath, original);

    const dryRun = await runMigration(root);
    expect(dryRun).toMatchObject({
      write: false,
      scannedFiles: 1,
      counts: { converted: 1, alreadyWrapped: 0, malformed: 0, missing: 0 }
    });
    expect(dryRun.backupPath).toBeNull();
    expect(await readFile(dailyPath)).toEqual(original);

    const written = await runMigration(root, {
      write: true,
      now: () => new Date("2026-07-25T10:20:30.000Z")
    });
    expect(written.counts.converted).toBe(1);
    expect(written.backupPath).toBe(path.join(root, ".tracker-backups", "notes-20260725-102030"));
    expect(await readFile(path.join(written.backupPath, "2026w04", "20260122_log.md"))).toEqual(original);
    const migrated = await readFile(dailyPath);
    expect(migrated.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(migrated.toString("utf8")).toContain("## Notes\r\n\r\n````tracker-notes\r\n# Heading\r\n````");

    const second = await runMigration(root, { write: true });
    expect(second.counts).toEqual({ converted: 0, alreadyWrapped: 1, malformed: 0, missing: 0 });
    expect(second.backupPath).toBeNull();
  });
});
