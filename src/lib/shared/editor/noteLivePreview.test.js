// @ts-nocheck
import { history, undo, undoDepth } from "@codemirror/commands";
import { EditorState, Transaction } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  collectNotePreviewRanges,
  createNoteMarkdownExtension,
  externalDocumentUpdate,
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

  it("preserves marker widths across mixed indented lists", () => {
    const doc = "- parent\n  * child\n    1. numbered\n  - sibling\n\nafter";
    const state = stateFor(doc, doc.indexOf("after"));
    const markers = rangesOfKind(state, "listMarker").map((range) => ({
      source: doc.slice(range.from, range.to),
      ordered: range.ordered
    }));

    expect(markers).toEqual([
      { source: "-", ordered: false },
      { source: "*", ordered: false },
      { source: "1.", ordered: true },
      { source: "-", ordered: false }
    ]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("renders unordered markers once, including the current line", () => {
    const doc = "- dash\n* star\n+ plus";
    const inactiveState = stateFor(doc);
    const inactiveMarkers = collectNotePreviewRanges(inactiveState, false).filter((r) => r.kind === "listMarker");

    expect(inactiveMarkers.map((r) => r.marker)).toEqual(["-", "*", "+"]);
    expect(inactiveMarkers.map((r) => inactiveState.sliceDoc(r.from, r.to))).toEqual(["-", "*", "+"]);

    const activeState = stateFor(doc, doc.indexOf("star"));
    expect(rangesOfKind(activeState, "listMarker").map((r) => activeState.sliceDoc(r.from, r.to))).toEqual(["-", "*", "+"]);

    const bareMarkerState = stateFor("-");
    expect(collectNotePreviewRanges(bareMarkerState, false).filter((r) => r.kind === "listMarker")).toHaveLength(0);
    expect(collectNotePreviewRanges(inactiveState, false).filter((r) => r.kind === "listLayout").map((r) => r.depth)).toEqual([0, 0, 0]);
  });

  it("keeps a task item rendered as a checkbox without turning into a bullet", () => {
    const activeTask = stateFor("- [ ] task item", 8);
    const ranges = collectNotePreviewRanges(activeTask);

    expect(rangesOfKind(activeTask, "listMarker")).toHaveLength(0);
    expect(ranges.some((r) => r.kind === "task")).toBe(true);
    expect(ranges.some((r) => r.kind === "listIndent" && activeTask.sliceDoc(r.from, r.to) === "- ")).toBe(true);
  });

  it("separates source indentation from the inactive list layout", () => {
    const doc = "- parent\n   2. child\n     - grandchild";
    const state = stateFor(doc, 0);
    const ranges = collectNotePreviewRanges(state, false);
    const markers = ranges.filter((range) => range.kind === "listMarker");

    expect(markers.map((range) => ({ marker: range.marker, depth: range.depth }))).toEqual([
      { marker: "-", depth: 0 },
      { marker: "1.", depth: 1 },
      { marker: "-", depth: 2 }
    ]);
    expect(ranges.filter((range) => range.kind === "listIndent").map((range) => doc.slice(range.from, range.to))).toEqual([
      "   ",
      "     "
    ]);
    expect(ranges.filter((range) => range.kind === "listLayout").map((range) => range.depth)).toEqual([0, 1, 2]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("uses parsed nesting rather than pasted whitespace for list depth", () => {
    const doc = "4. spaces\n   - child\n5. tab\n\t- child\n6. ordered tab\n\t1. child";
    const state = stateFor(doc);
    const markers = rangesOfKind(state, "listMarker");

    expect(markers.map((range) => range.depth)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(collectNotePreviewRanges(state, false).filter((range) => range.kind === "listLayout").map((range) => range.depth)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("treats two-space ordered children as nested when CodeMirror flattens them", () => {
    const doc = "4. parent\n  5. sadas\n  6. sda\n    7. asda\n    8. asdas";
    const state = stateFor(doc);
    const markers = rangesOfKind(state, "listMarker");

    expect(markers.map((range) => range.depth)).toEqual([0, 1, 1, 2, 2]);
    expect(collectNotePreviewRanges(state, false).filter((range) => range.kind === "listLayout").map((range) => range.depth)).toEqual([0, 1, 1, 2, 2]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("continues visual ordinals across adjacent parsed OrderedLists while preserving delimiters", () => {
    const doc = "3. first\n7) second\n\n3. parent\n   2. child";
    const state = stateFor(doc);
    const ranges = collectNotePreviewRanges(state, false);
    const orderedRanges = ranges.filter((r) => r.kind === "listMarker");

    expect(orderedRanges.map((r) => r.marker)).toEqual(["1.", "2)", "3.", "1."]);
    expect(orderedRanges.map((r) => state.sliceDoc(r.from, r.to))).toEqual(["3.", "7)", "3.", "2."]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("restarts visual ordinals after a non-list block or BulletList", () => {
    const doc = "3. first\n7) second\n\nParagraph\n\n8. restart\n\n- bullet\n\n9. after bullet";
    const state = stateFor(doc);
    const orderedRanges = collectNotePreviewRanges(state, false).filter((r) => r.kind === "listMarker" && r.ordered);

    expect(orderedRanges.map((r) => r.marker)).toEqual(["1.", "2)", "1.", "1."]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("restarts visible numbering for a nested parsed OrderedList", () => {
    const doc = "3. parent\n   8. child\n   9) child two\n7. sibling";
    const state = stateFor(doc);
    const orderedRanges = collectNotePreviewRanges(state, false).filter((r) => r.kind === "listMarker");

    expect(orderedRanges.map((r) => r.marker)).toEqual(["1.", "1.", "2)", "2."]);
    expect(orderedRanges.map((r) => state.sliceDoc(r.from, r.to))).toEqual(["3.", "8.", "9)", "7."]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("renders nested list markers while the caret is inside the child", () => {
    const doc = "3. parent\n   8. child";
    const state = stateFor(doc, doc.indexOf("child"));
    const markers = rangesOfKind(state, "listMarker");

    expect(markers.map((range) => range.marker)).toEqual(["1.", "1."]);
    expect(markers.map((range) => doc.slice(range.from, range.to))).toEqual(["3.", "8."]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("renders an empty list item once its marker has a following space", () => {
    const doc = "- \n  - child";
    const state = stateFor(doc);
    const markers = collectNotePreviewRanges(state, false).filter((range) => range.kind === "listMarker");

    expect(markers).toHaveLength(2);
    expect(markers.map((range) => range.marker)).toEqual(["-", "-"]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("renders a newly continued ordered marker before content is typed", () => {
    const doc = "18. item\n19. ";
    const state = stateFor(doc, doc.length);
    const markers = rangesOfKind(state, "listMarker");

    expect(markers.map((range) => range.marker)).toEqual(["1.", "2."]);
    expect(markers.map((range) => doc.slice(range.from, range.to))).toEqual(["18.", "19."]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("renders ordered-looking paragraph lines after bullets as one visual run", () => {
    const doc = "- item\n* item\n3. item\n7) item";
    const state = stateFor(doc);
    const markers = collectNotePreviewRanges(state, false).filter((range) => range.kind === "listMarker");

    expect(markers.map((range) => range.marker)).toEqual(["-", "*", "1.", "2)"]);
    expect(markers.map((range) => state.sliceDoc(range.from, range.to))).toEqual(["-", "*", "3.", "7)"]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("renders a fallback marker while retaining its run position", () => {
    const doc = "- item\n* item\n3. item\n7) item\n8. item";
    const state = stateFor(doc, doc.indexOf("7) item") + 4);
    const markers = rangesOfKind(state, "listMarker");

    expect(markers.map((range) => range.marker)).toEqual(["-", "*", "1.", "2)", "3."]);
    expect(markers.map((range) => state.sliceDoc(range.from, range.to))).toEqual(["-", "*", "3.", "7)", "8."]);
    expect(state.doc.toString()).toBe(doc);
  });

  it("does not apply the fallback to an ordinary Paragraph", () => {
    const doc = "prefix\n3. literal";
    const state = stateFor(doc);

    expect(collectNotePreviewRanges(state, false).filter((range) => range.kind === "listMarker")).toHaveLength(0);
    expect(state.doc.toString()).toBe(doc);
  });

  it("resets fallback ordinals after another source line in the bullet paragraph", () => {
    const doc = "- item\n3. one\ncontinuation\n7) two";
    const state = stateFor(doc);
    const markers = collectNotePreviewRanges(state, false).filter((range) => range.kind === "listMarker");

    expect(markers.map((range) => range.marker)).toEqual(["-", "1.", "1)"]);
  });

  it("supports 2-space indented sub-lists for AI and pasted markdown", () => {
    const doc = "3. parent\n  2. subitem\n4. sibling";
    const state = stateFor(doc);
    const orderedMarkers = collectNotePreviewRanges(state, false).filter((range) => range.kind === "listMarker");

    expect(orderedMarkers.map((range) => range.marker)).toEqual(["1.", "1.", "2."]);
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

  it("prevents duplicate source marker text inside unordered ListMarkerWidget DOM", () => {
    const doc = "- item\n* item\n+ item\n> quote";
    const state = stateFor(doc);
    const ranges = collectNotePreviewRanges(state, false);
    const listRanges = ranges.filter((r) => r.kind === "listMarker");

    expect(listRanges).toHaveLength(3);
    expect(listRanges[0].ordered).toBe(false);
    expect(listRanges[1].ordered).toBe(false);
    expect(listRanges[2].ordered).toBe(false);
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
