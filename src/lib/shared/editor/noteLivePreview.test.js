// @ts-nocheck
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  collectNotePreviewRanges,
  createNoteMarkdownExtension,
  externalDocumentUpdate,
  taskMarkerChange
} from "./noteLivePreview.js";

function stateFor(doc, anchor = 0, head = anchor) {
  return EditorState.create({
    doc,
    selection: { anchor, head },
    extensions: [createNoteMarkdownExtension()]
  });
}

function rangesOfKind(state, kind) {
  return collectNotePreviewRanges(state).filter((range) => range.kind === kind);
}

describe("note live-preview ranges", () => {
  it("hides inactive syntax and reveals the complete syntax construct under the selection", () => {
    const doc = "# Heading\n\n**bold** and *italic*";
    const headingActive = stateFor(doc, 3);

    expect(rangesOfKind(headingActive, "hide").map(({ from, to }) => doc.slice(from, to))).not.toContain("# ");
    expect(rangesOfKind(headingActive, "hide").map(({ from, to }) => doc.slice(from, to))).toEqual(
      expect.arrayContaining(["**", "**", "*", "*"])
    );
    expect(
      collectNotePreviewRanges(headingActive, false)
        .filter((range) => range.kind === "hide")
        .map(({ from, to }) => doc.slice(from, to))
    ).toContain("# ");

    const boldActive = stateFor(doc, doc.indexOf("bold") + 1);
    expect(rangesOfKind(boldActive, "hide").map(({ from, to }) => doc.slice(from, to))).not.toContain("**");
    expect(rangesOfKind(boldActive, "hide").map(({ from, to }) => doc.slice(from, to))).toContain("# ");
  });

  it("recognizes lists, tasks, blockquotes, links, and horizontal rules without altering source", () => {
    const doc = [
      "- [ ] task",
      "- bullet",
      "> quote",
      "[label](https://example.com)",
      "---",
      "after"
    ].join("\n");
    const state = stateFor(doc, doc.indexOf("after") + 2);
    const ranges = collectNotePreviewRanges(state);

    expect(ranges.some((range) => range.kind === "task" && doc.slice(range.from, range.to) === "[ ]")).toBe(true);
    expect(ranges.some((range) => range.kind === "bullet" && doc.slice(range.from, range.to) === "- ")).toBe(true);
    expect(ranges.some((range) => range.kind === "hide" && doc.slice(range.from, range.to) === "> ")).toBe(true);
    expect(ranges.some((range) => range.kind === "link" && range.label === "label")).toBe(true);
    expect(ranges.some((range) => range.kind === "rule" && doc.slice(range.from, range.to) === "---")).toBe(true);
    expect(state.doc.toString()).toBe(doc);
  });

  it.each([3, 4, 5])("preserves a %s-backtick fence, its language, and shorter inner runs", (fenceLength) => {
    const fence = "`".repeat(fenceLength);
    const inner = "`".repeat(Math.max(1, fenceLength - 1));
    const doc = `${fence}js\n${inner}inner${inner}\n${fence}`;
    const state = stateFor(doc, doc.indexOf("inner"));
    const ranges = collectNotePreviewRanges(state);

    expect(state.doc.toString()).toBe(doc);
    expect(ranges.some((range) => range.kind === "codeblock" && range.language === "js")).toBe(true);
    expect(rangesOfKind(state, "hide").some(({ from, to }) => doc.slice(from, to) === fence)).toBe(false);
  });
});

describe("note editor document transactions", () => {
  it("toggles only the selected task marker", () => {
    const doc = "- [ ] first\n- [x] second";
    const state = stateFor(doc);
    const firstFrom = doc.indexOf("[ ]");
    const secondFrom = doc.indexOf("[x]");

    const first = state.update({ changes: taskMarkerChange(state, firstFrom, firstFrom + 3) }).state;
    expect(first.doc.toString()).toBe("- [x] first\n- [x] second");

    const second = first.update({ changes: taskMarkerChange(first, secondFrom, secondFrom + 3) }).state;
    expect(second.doc.toString()).toBe("- [x] first\n- [ ] second");
  });

  it("ignores echoed external values and excludes real external replacements from undo history", () => {
    const state = stateFor("alpha", 3);

    expect(externalDocumentUpdate(state, "alpha")).toBeNull();
    const update = externalDocumentUpdate(state, "a much longer external value");
    expect(update).toMatchObject({
      changes: { from: 0, to: 5, insert: "a much longer external value" },
      selection: { anchor: 3 }
    });
    expect(update.annotations).toBeTruthy();
  });
});
