import { Transaction } from "@codemirror/state";

/** @param {import("@codemirror/view").EditorView} view */
export function captureCodeMirrorText(view) {
  const { from, to } = view.state.selection.main;

  return {
    value: view.state.doc.toString(),
    selectionStart: from,
    selectionEnd: to,
    selectedText: view.state.sliceDoc(from, to),
    focus: () => view.focus(),
    setSelectionRange: (/** @type {number} */ start, /** @type {number} */ end) => {
      view.dispatch({
        selection: { anchor: start, head: end },
        scrollIntoView: true
      });
    },
    replaceSelection: (/** @type {string} */ text, /** @type {string} */ inputType) => {
      const userEvent = inputType === "deleteByCut" ? "delete.cut" : "input.paste";
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        annotations: Transaction.userEvent.of(userEvent),
        scrollIntoView: true
      });
    }
  };
}
