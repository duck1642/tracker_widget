/**
 * Returns the completed text insertion when a typed closing bracket finishes
 * a GFM bullet-task marker at the end of a line.
 */
export function taskMarkerCompletion(state: import("@codemirror/state").EditorState, from: number, to: number, text: string) {
  if (from !== to) return null;

  const line = state.doc.lineAt(from);
  if (to !== line.to) return null;

  if (
    text === " " &&
    /^\s*[-+*]\s+\[[ xX]\] $/.test(state.sliceDoc(line.from, line.to))
  ) {
    return "";
  }

  if (text !== "]") return null;
  const completedLine = state.sliceDoc(line.from, from) + text;
  return /^\s*[-+*]\s+\[[ xX]\]$/.test(completedLine) ? "] " : null;
}


export function completeTaskMarkerInput(view: import("@codemirror/view").EditorView, from: number, to: number, text: string) {
  const insert = taskMarkerCompletion(view.state, from, to, text);
  if (insert === null) return false;

  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
    userEvent: "input.type"
  });
  return true;
}
