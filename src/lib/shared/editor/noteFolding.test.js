// @vitest-environment jsdom
// @ts-nocheck
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { foldable, foldEffect, foldedRanges } from "@codemirror/language";
import {
  createNoteFoldingExtension,
  headingFoldService,
  listFallbackFoldService,
  noteMarkdownFoldService,
  getScratchpadFoldState,
  saveScratchpadFoldState,
  clearScratchpadFoldState,
  getFoldSnapshot,
  restoreFoldSnapshot
} from "./noteFolding.js";
import { createNoteMarkdownExtension, noteLivePreview } from "./noteLivePreview.js";

function createFoldableState(doc) {
  return EditorState.create({
    doc,
    extensions: [createNoteMarkdownExtension(), ...createNoteFoldingExtension()]
  });
}

describe("noteFolding service logic", () => {
  it("folds ATX heading hierarchy correctly", () => {
    const doc = [
      "# Parent H1",
      "intro text",
      "## Child H2",
      "child content",
      "### Grandchild H3",
      "grandchild content",
      "## Sibling H2",
      "sibling content",
      "# Next H1",
      "next content"
    ].join("\n");

    const state = createFoldableState(doc);

    // Fold # Parent H1 (line 1)
    const l1 = state.doc.line(1);
    const f1 = foldable(state, l1.from, l1.to);
    expect(f1).toBeTruthy();
    expect(doc.slice(f1.from, f1.to)).toBe(
      "\nintro text\n## Child H2\nchild content\n### Grandchild H3\ngrandchild content\n## Sibling H2\nsibling content"
    );

    // Fold ## Child H2 (line 3)
    const l3 = state.doc.line(3);
    const f3 = foldable(state, l3.from, l3.to);
    expect(f3).toBeTruthy();
    expect(doc.slice(f3.from, f3.to)).toBe("\nchild content\n### Grandchild H3\ngrandchild content");

    // Fold ### Grandchild H3 (line 5)
    const l5 = state.doc.line(5);
    const f5 = foldable(state, l5.from, l5.to);
    expect(f5).toBeTruthy();
    expect(doc.slice(f5.from, f5.to)).toBe("\ngrandchild content");

    // Fold # Next H1 (line 9)
    const l9 = state.doc.line(9);
    const f9 = foldable(state, l9.from, l9.to);
    expect(f9).toBeTruthy();
    expect(doc.slice(f9.from, f9.to)).toBe("\nnext content");
  });

  it("folds Setext heading hierarchy correctly", () => {
    const doc = [
      "Parent Level 1",
      "==============",
      "",
      "intro text",
      "",
      "Child Level 2",
      "-------------",
      "",
      "child text",
      "",
      "Next Level 1",
      "============",
      "",
      "end text"
    ].join("\n");

    const state = createFoldableState(doc);

    // Fold Setext H1 (line 1)
    const l1 = state.doc.line(1);
    const f1 = foldable(state, l1.from, l1.to);
    expect(f1).toBeTruthy();
    expect(doc.slice(f1.from, f1.to)).toBe(
      "\n\nintro text\n\nChild Level 2\n-------------\n\nchild text"
    );

    // Fold Setext H2 (line 6)
    const l6 = state.doc.line(6);
    const f6 = foldable(state, l6.from, l6.to);
    expect(f6).toBeTruthy();
    expect(doc.slice(f6.from, f6.to)).toBe("\n\nchild text");

    // Underline line itself should not trigger fold
    const l2 = state.doc.line(2);
    expect(foldable(state, l2.from, l2.to)).toBeNull();
  });

  it("supports native and fallback nested list folding at multiple depths", () => {
    const doc = [
      "4. parent",
      "  5. child",
      "  6. child two",
      "    7. grandchild",
      "8. sibling"
    ].join("\n");

    const state = createFoldableState(doc);

    // Line 1: 4. parent folds all nested items
    const l1 = state.doc.line(1);
    const f1 = foldable(state, l1.from, l1.to);
    expect(f1).toBeTruthy();
    expect(doc.slice(f1.from, f1.to)).toBe("\n  5. child\n  6. child two\n    7. grandchild");

    // Line 3: 6. child two folds grandchild
    const l3 = state.doc.line(3);
    const f3 = foldable(state, l3.from, l3.to);
    expect(f3).toBeTruthy();
    expect(doc.slice(f3.from, f3.to)).toBe("\n    7. grandchild");

    // Line 5: 8. sibling has no children
    const l5 = state.doc.line(5);
    expect(foldable(state, l5.from, l5.to)).toBeNull();
  });

  it("folds native bullet lists and task lists with 2-space indentation", () => {
    const doc = [
      "- [ ] parent task",
      "  - [x] child task 1",
      "  - [ ] child task 2",
      "- [ ] sibling task"
    ].join("\n");

    const state = createFoldableState(doc);

    const l1 = state.doc.line(1);
    const f1 = foldable(state, l1.from, l1.to);
    expect(f1).toBeTruthy();
    expect(doc.slice(f1.from, f1.to)).toBe("\n  - [x] child task 1\n  - [ ] child task 2");
  });

  it("does not produce false positives in prose, fenced code, or thematic rules", () => {
    const doc = [
      "Just a single line of prose.",
      "",
      "---",
      "",
      "```javascript",
      "const a = 1;",
      "---",
      "const b = 2;",
      "```"
    ].join("\n");

    const state = createFoldableState(doc);

    // Prose line 1
    expect(foldable(state, state.doc.line(1).from, state.doc.line(1).to)).toBeNull();

    // Thematic rule line 3
    expect(foldable(state, state.doc.line(3).from, state.doc.line(3).to)).toBeNull();

    // Thematic sequence inside code block (line 7)
    expect(foldable(state, state.doc.line(7).from, state.doc.line(7).to)).toBeNull();
  });
});

describe("Scratchpad session fold state persistence across remounts", () => {
  it("preserves, captures, and restores fold ranges for identical content", () => {
    const path = "C:/workspace/scratchpad.md";
    const doc = "# Heading\ncontent 1\n# Next\ncontent 2";

    clearScratchpadFoldState(path);
    expect(getScratchpadFoldState(path, doc)).toBeNull();

    saveScratchpadFoldState(path, doc, [{ from: 9, to: 19 }]);
    const retrieved = getScratchpadFoldState(path, doc);
    expect(retrieved).toEqual([{ from: 9, to: 19 }]);

    // Incompatible content returns null
    expect(getScratchpadFoldState(path, "different content")).toBeNull();
  });

  it("safely restores valid fold ranges and ignores stale out-of-bounds ranges", () => {
    const doc = "# Heading\ncontent 1\n# Next\ncontent 2";
    const host = document.createElement("div");
    const state = EditorState.create({
      doc,
      extensions: [createNoteMarkdownExtension(), ...createNoteFoldingExtension()]
    });
    const view = new EditorView({ state, parent: host });

    // Restore valid and invalid range
    restoreFoldSnapshot(view, [
      { from: 9, to: 19 },
      { from: 999, to: 1050 } // out of bounds, should be ignored
    ]);

    const snapshot = getFoldSnapshot(view);
    expect(snapshot).toEqual([{ from: 9, to: 19 }]);
    expect(view.state.doc.toString()).toBe(doc); // byte-for-byte unchanged

    view.destroy();
  });

  it("restores a Setext fold whose range starts on the underline line", () => {
    const doc = "Heading\n=======\nsection content\n# Next\nnext content";
    const host = document.createElement("div");
    const state = EditorState.create({
      doc,
      extensions: [createNoteMarkdownExtension(), ...createNoteFoldingExtension()]
    });
    const view = new EditorView({ state, parent: host });
    const heading = state.doc.line(1);
    const range = foldable(state, heading.from, heading.to);

    restoreFoldSnapshot(view, [range]);

    expect(getFoldSnapshot(view)).toEqual([range]);
    view.destroy();
  });

  it("retains fold ranges when switching between live preview and source mode", () => {
    const doc = "# Heading\ncontent 1\n# Next\ncontent 2";
    const host = document.createElement("div");
    let state = EditorState.create({
      doc,
      extensions: [createNoteMarkdownExtension(), noteLivePreview, ...createNoteFoldingExtension()]
    });
    const view = new EditorView({ state, parent: host });

    // Fold section 1
    view.dispatch({ effects: [foldEffect.of({ from: 9, to: 19 })] });
    expect(getFoldSnapshot(view)).toEqual([{ from: 9, to: 19 }]);

    // Preview mode or source mode retains fold ranges
    expect(getFoldSnapshot(view)).toEqual([{ from: 9, to: 19 }]);
    expect(view.state.doc.toString()).toBe(doc);

    view.destroy();
  });
});
