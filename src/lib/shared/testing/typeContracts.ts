// Compile-only examples. This file is deliberately outside Vitest discovery.
import type { ComponentProps } from "svelte";
import type NotesEditor from "../components/NotesEditor.svelte";
import { readFile } from "../services/fileService.ts";
import { parseDailyLog } from "../../features/daily/dailyLogParser.ts";
import type { DailyDocument } from "../../features/daily/types.ts";
import type { TodoLine } from "../../features/todo/types.ts";
import { DocumentController, type DocumentOptions, type FileService } from "../persistence/documentController.ts";

export async function verifyTypeContracts(fileService: FileService, line: TodoLine) {
  const content: string = await readFile("example.md");
  // @ts-expect-error A file read returns text, not an object with arbitrary fields.
  content.arbitraryProperty;

  const document: DailyDocument = parseDailyLog(content, "2026-10-01");
  // @ts-expect-error A daily document cannot be used as plain text.
  const invalidText: string = document;
  void invalidText;

  const adapter: DocumentOptions<DailyDocument, { date: string }> = {
    fileService,
    prepare: (text, meta) => parseDailyLog(text, meta.context?.date),
    apply: (prepared) => { prepared.sessions.map((session) => session.name); }
  };
  new DocumentController(adapter);
  // @ts-expect-error Apply accepts the model produced by prepare.
  adapter.apply?.("unparsed content", { path: "example.md", context: { date: "2026-10-01" }, reason: "open" });
  // @ts-expect-error Every adapter must supply its prepare step.
  new DocumentController({ fileService });

  const props: ComponentProps<typeof NotesEditor> = { onChange: (text) => text.length };
  // @ts-expect-error Editor callbacks accept text.
  props.onChange(42);
  // @ts-expect-error onChange is a required prop.
  const missingCallback: ComponentProps<typeof NotesEditor> = {};
  void missingCallback;

  if (!line.isTodo) {
    // @ts-expect-error Raw Markdown lines have no checklist fields.
    line.checked;
  }
}
