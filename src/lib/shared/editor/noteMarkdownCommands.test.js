// @ts-nocheck
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { describe, expect, it } from "vitest";
import { continueNoteMarkdownList } from "./noteMarkdownCommands.js";

function pressEnter(doc, anchor = doc.length) {
  const state = EditorState.create({
    doc,
    selection: { anchor },
    extensions: [markdown()]
  });
  let transaction;

  const handled = continueNoteMarkdownList({
    state,
    dispatch: (next) => {
      transaction = next;
    }
  });

  return {
    handled,
    doc: transaction?.newDoc.toString(),
    cursor: transaction?.newSelection.main.head
  };
}

describe("note editor markdown Enter", () => {
  it("continues a tight task list on the next line", () => {
    const result = pressEnter("- [ ] first\n- [ ] second");

    expect(result.handled).toBe(true);
    expect(result.doc).toBe("- [ ] first\n- [ ] second\n- [ ] ");
    expect(result.cursor).toBe(result.doc.length);
  });

  it("does not copy an earlier loose-list gap into a new task", () => {
    const result = pressEnter("- Intro\n\n- [ ] first\n- [ ] second");

    expect(result.handled).toBe(true);
    expect(result.doc).toBe("- Intro\n\n- [ ] first\n- [ ] second\n- [ ] ");
    expect(result.cursor).toBe(result.doc.length);
  });

  it("does not copy an earlier loose-list gap into a new bullet", () => {
    const result = pressEnter("- Intro\n\n- first\n- second");

    expect(result.handled).toBe(true);
    expect(result.doc).toBe("- Intro\n\n- first\n- second\n- ");
  });

  it("keeps the native empty-task behavior that exits the list", () => {
    const result = pressEnter("- [ ] task\n- [ ] ");

    expect(result.handled).toBe(true);
    expect(result.doc).toBe("- [ ] task\n");
  });

  it("leaves non-list Enter for the fallback keymap", () => {
    const result = pressEnter("plain text");

    expect(result.handled).toBe(false);
    expect(result.doc).toBeUndefined();
  });
});
