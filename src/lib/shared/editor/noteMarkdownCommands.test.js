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

function continueFromState(state) {
  let transaction;
  const handled = continueNoteMarkdownList({
    state,
    dispatch: (next) => {
      transaction = next;
    }
  });

  return { handled, state: transaction?.state };
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

  it.each([
    [".", "3. first", "3. first\n4. "],
    [")", "7) first", "7) first\n8) "]
  ])("continues a top-level ordered list with its %s delimiter", (_delimiter, input, expected) => {
    const result = pressEnter(input);

    expect(result.handled).toBe(true);
    expect(result.doc).toBe(expected);
    expect(result.cursor).toBe(result.doc.length);
  });

  it.each([
    [".", "1. parent\n   4. child", "1. parent\n   4. child\n   5. "],
    [")", "1) parent\n   4) child", "1) parent\n   4) child\n   5) "]
  ])("continues a nested ordered list with its %s delimiter and indentation", (_delimiter, input, expected) => {
    const result = pressEnter(input);

    expect(result.handled).toBe(true);
    expect(result.doc).toBe(expected);
    expect(result.cursor).toBe(result.doc.length);
  });

  it("renumbers sequential siblings when inserting an ordered item", () => {
    const input = "3. first\n4. second";
    const result = pressEnter(input, input.indexOf("\n"));

    expect(result.handled).toBe(true);
    expect(result.doc).toBe("3. first\n4. \n5. second");
  });

  it.each([
    [".", "3. first\n4. \n5. third", "3. first\n\n4. third"],
    [")", "3) first\n4) \n5) third", "3) first\n\n4) third"]
  ])("renumbers subsequent siblings when exiting an empty %s item", (_delimiter, input, expected) => {
    const result = pressEnter(input, input.lastIndexOf("\n"));

    expect(result.handled).toBe(true);
    expect(result.doc).toBe(expected);
  });

  it.each(["x", "xx", "xxx", "xxxx", "normal text"])("leaves normal text after an ordered list to the fallback Enter handler: %s", (text) => {
    let state = EditorState.create({
      doc: "3. item",
      selection: { anchor: 7 },
      extensions: [markdown()]
    });

    ({ state } = continueFromState(state));
    ({ state } = continueFromState(state));

    const cursor = state.selection.main.head;
    state = state.update({
      changes: { from: cursor, insert: text },
      selection: { anchor: cursor + text.length },
      userEvent: "input.type"
    }).state;

    const result = continueFromState(state);

    expect(result.handled).toBe(false);
    expect(result.state).toBeUndefined();
    expect(state.doc.toString()).toBe(`3. item\n${text}`);
  });

  it("preserves an intentional numbering break when editing the preceding item", () => {
    const input = "3. first\n9. intentional restart";
    const result = pressEnter(input, input.indexOf("\n"));

    expect(result.handled).toBe(true);
    expect(result.doc).toBe("3. first\n4. \n9. intentional restart");
  });

  it("does not insert a list marker when pressing Enter on a blank line", () => {
    const result = pressEnter("1. item 1\n2. item 2\n\n");

    expect(result.handled).toBe(false);
    expect(result.doc).toBeUndefined();
  });

  it("leaves non-list Enter for the fallback keymap", () => {
    const result = pressEnter("plain text");

    expect(result.handled).toBe(false);
    expect(result.doc).toBeUndefined();
  });
});
