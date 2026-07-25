// @ts-nocheck
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { taskMarkerCompletion } from "./noteEditorInput.js";

function completion(doc, text = "]", from = doc.length) {
  return taskMarkerCompletion(EditorState.create({ doc }), from, from, text);
}

describe("note editor task-marker input", () => {
  it.each(["- [ ", "* [ ", "+ [ ", "  - [ ", "- [x", "- [X"])(
    "adds the required GFM space after completing %s]",
    (before) => {
      expect(completion(before)).toBe("] ");
    }
  );

  it.each([
    "plain [ ",
    "1. [ ",
    "- text [ ",
    "- [x] trailing"
  ])("does not alter unrelated closing brackets in %s", (before) => {
    expect(completion(before)).toBeNull();
  });

  it("does not alter replacement input or non-bracket input", () => {
    const state = EditorState.create({ doc: "- [ " });
    expect(taskMarkerCompletion(state, 2, 4, "]")).toBeNull();
    expect(taskMarkerCompletion(state, 4, 4, "x")).toBeNull();
  });
});
