import { Transaction } from "@codemirror/state";


export function captureCodeMirrorText(view: import("@codemirror/view").EditorView) {
  const { from, to } = view.state.selection.main;

  return {
    value: view.state.doc.toString(),
    selectionStart: from,
    selectionEnd: to,
    selectedText: view.state.sliceDoc(from, to),
    focus: () => view.focus(),
    setSelectionRange: ( start: number,  end: number) => {
      view.dispatch({
        selection: { anchor: start, head: end },
        scrollIntoView: true
      });
    },
    replaceSelection: ( text: string,  inputType: string) => {
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
