// @ts-nocheck
import { history, undo, undoDepth } from "@codemirror/commands";
import { foldEffect, unfoldEffect } from "@codemirror/language";
import { EditorState, Transaction } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  collectNotePreviewRanges,
  createNoteMarkdownExtension,
  externalDocumentUpdate,
  noteEditorFolding,
  taskMarkerChange
} from "./noteLivePreview.js";

function stateFor(doc, anchor = 0, head = anchor, extensions = []) {
  return EditorState.create({
    doc,
    selection: { anchor, head },
    extensions: [createNoteMarkdownExtension(), ...extensions]
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
    expect(ranges.some((range) => range.kind === "listMarker" && doc.slice(range.from, range.to) === "-")).toBe(true);
    expect(ranges.some((range) => range.kind === "hide" && doc.slice(range.from, range.to) === "> ")).toBe(true);
    expect(ranges.some((range) => range.kind === "link" && range.label === "label")).toBe(true);
    expect(ranges.some((range) => range.kind === "rule" && doc.slice(range.from, range.to) === "---")).toBe(true);
    expect(state.doc.toString()).toBe(doc);
  });

  it("preserves marker widths and records the depth of mixed nested lists", () => {
    const doc = "- parent\n  * child\n    1. numbered\n  - sibling\n\nafter";
    const state = stateFor(doc, doc.indexOf("after"));
    const markers = rangesOfKind(state, "listMarker").map((range) => ({
      source: doc.slice(range.from, range.to),
      depth: range.depth,
      ordered: range.ordered
    }));

    expect(markers).toEqual([
      { source: "-", depth: 0, ordered: false },
      { source: "*", depth: 1, ordered: false },
      { source: "1.", depth: 2, ordered: true },
      { source: "-", depth: 1, ordered: false }
    ]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("does not reveal a parent marker while editing a nested child", () => {
    const doc = "- parent\n  - child";
    const state = stateFor(doc, doc.indexOf("- child"));
    const markers = rangesOfKind(state, "listMarker");

    expect(markers.map((range) => doc.slice(range.from, range.to))).toEqual(["-"]);
    expect(markers[0].depth).toBe(0);
  });

  it("exposes native fold ranges only for list items with foldable content", () => {
    const doc = "- parent\n  - child\n  - sibling\n\noutside";
    const state = stateFor(doc, doc.indexOf("outside"), undefined, [noteEditorFolding]);
    const folds = rangesOfKind(state, "listFold");

    expect(folds).toHaveLength(1);
    expect(doc.slice(folds[0].foldFrom, folds[0].foldTo)).toContain("- child");
    expect(doc.slice(folds[0].foldFrom, folds[0].foldTo)).toContain("- sibling");
    expect(folds[0].folded).toBe(false);
  });

  it("tracks fold and unfold effects without changing the Markdown source", () => {
    const doc = "- parent\n  - child\n  - sibling\n\noutside";
    const initial = stateFor(doc, doc.indexOf("outside"), undefined, [noteEditorFolding]);
    const range = rangesOfKind(initial, "listFold")[0];
    const folded = initial.update({
      effects: foldEffect.of({ from: range.foldFrom, to: range.foldTo })
    }).state;

    expect(rangesOfKind(folded, "listFold")[0].folded).toBe(true);
    expect(folded.doc.toString()).toBe(doc);

    const unfolded = folded.update({
      effects: unfoldEffect.of({ from: range.foldFrom, to: range.foldTo })
    }).state;
    expect(rangesOfKind(unfolded, "listFold")[0].folded).toBe(false);
    expect(unfolded.doc.toString()).toBe(doc);
  });

  it("keeps a recognized task rendered while its text is actively edited", () => {
    const doc = "- [ ] active task";
    const state = stateFor(doc, doc.indexOf("task") + 2);
    const ranges = collectNotePreviewRanges(state);

    expect(ranges.some((range) => range.kind === "task")).toBe(true);
    expect(ranges.some((range) => range.kind === "hide" && doc.slice(range.from, range.to) === "- ")).toBe(true);
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

  it("ignores echoed values and preserves selection and history across external replacements", () => {
    const initial = stateFor("alpha", 4, 1, [history()]);
    const locallyEdited = initial.update({
      changes: { from: 5, insert: "!" },
      annotations: Transaction.userEvent.of("input.type")
    }).state;

    expect(externalDocumentUpdate(initial, "alpha")).toBeNull();
    const update = externalDocumentUpdate(locallyEdited, "Alpha!");
    expect(update).toMatchObject({
      changes: { from: 0, to: 1, insert: "A" }
    });
    expect(update.annotations).toBeTruthy();

    const externallyUpdated = locallyEdited.update(update).state;
    expect(externallyUpdated.selection.main.anchor).toBe(4);
    expect(externallyUpdated.selection.main.head).toBe(1);
    expect(undoDepth(externallyUpdated)).toBe(undoDepth(locallyEdited));

    let undone;
    expect(undo({
      state: externallyUpdated,
      dispatch: (transaction) => {
        undone = transaction.state;
      }
    })).toBe(true);
    expect(undone.doc.toString()).toBe("Alpha");
  });
});
