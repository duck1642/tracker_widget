import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findWeeklyIndexFiles, migrateObjectiveContent, runMigration } from "./migrate-objectives.mjs";

const temporaryRoots = [];

async function temporaryWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), "tracker-objective-migration-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("objective migration", () => {
  it("removes legacy origins only from valid objectives and preserves line endings", () => {
    const input = [
      "# Week",
      "",
      "## Objectives",
      "",
      "- {subjects: (rust), origin: planned, status: open} Parent",
      "  - {subjects: (ui), status: partial, origin: unplanned} Child",
      "    - {subjects: (parser), origin: planned, status: done} Grandchild",
      "      - {subjects: (deep), origin: planned, status: open} Preserve depth",
      "- {subjects: (raw), origin: accidental, status: open} Preserve invalid origin",
      "- {subjects: (raw), origin: planned, status: open, extra: value} Preserve unknown metadata",
      "",
      "## Notes",
      "origin: planned"
    ].join("\r\n");

    const result = migrateObjectiveContent(input);

    expect(result.counts).toEqual({ planned: 2, unplanned: 1 });
    expect(result.content).toContain("- {subjects: (rust), status: open} Parent\r\n");
    expect(result.content).toContain("  - {subjects: (ui), status: partial} Child\r\n");
    expect(result.content).toContain("    - {subjects: (parser), status: done} Grandchild\r\n");
    expect(result.content).toContain("      - {subjects: (deep), origin: planned, status: open} Preserve depth");
    expect(result.content).toContain("origin: accidental");
    expect(result.content).toContain("extra: value");
    expect(result.content.endsWith("## Notes\r\norigin: planned")).toBe(true);
  });

  it("handles origin as the first metadata field and is idempotent", () => {
    const input = "## Objectives\n\n- {origin: planned, subjects: (rust), status: open} First\n";
    const first = migrateObjectiveContent(input);
    const second = migrateObjectiveContent(first.content);
    expect(first.content).toBe("## Objectives\n\n- {subjects: (rust), status: open} First\n");
    expect(second).toMatchObject({ changed: false, total: 0, content: first.content });
  });

  it("scans only canonical weekly index paths", async () => {
    const root = await temporaryWorkspace();
    await mkdir(path.join(root, "2026w01"));
    await mkdir(path.join(root, "other"));
    await writeFile(path.join(root, "2026w01", "2026w01_index.md"), "index");
    await writeFile(path.join(root, "2026w01", "other.md"), "other");
    await writeFile(path.join(root, "other", "other_index.md"), "other");
    expect(await findWeeklyIndexFiles(root)).toEqual([path.join(root, "2026w01", "2026w01_index.md")]);
  });

  it("defaults to dry-run, preserves BOM, and writes only when requested", async () => {
    const root = await temporaryWorkspace();
    const week = path.join(root, "2026w02");
    const indexPath = path.join(week, "2026w02_index.md");
    await mkdir(week);
    const original = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("## Objectives\r\n\r\n- {subjects: (rust), origin: unplanned, status: open} Ship\r\n")
    ]);
    await writeFile(indexPath, original);

    const dryRun = await runMigration(root);
    expect(dryRun).toMatchObject({ write: false, scannedFiles: 1, total: 1, totals: { planned: 0, unplanned: 1 } });
    expect(await readFile(indexPath)).toEqual(original);

    const written = await runMigration(root, { write: true });
    expect(written.total).toBe(1);
    const migrated = await readFile(indexPath);
    expect(migrated.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(migrated.toString("utf8")).toContain("- {subjects: (rust), status: open} Ship\r\n");
    expect((await runMigration(root)).total).toBe(0);
  });
});
