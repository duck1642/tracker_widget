/**
 * Returns the completed text insertion when a typed closing bracket finishes
 * a GFM bullet-task marker at the end of a line.
 * @param {import("@codemirror/state").EditorState} state
 * @param {number} from
 * @param {number} to
 * @param {string} text
 */
export function taskMarkerCompletion(state, from, to, text) {
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

/**
 * @param {import("@codemirror/view").EditorView} view
 * @param {number} from
 * @param {number} to
 * @param {string} text
 */
export function completeTaskMarkerInput(view, from, to, text) {
  const insert = taskMarkerCompletion(view.state, from, to, text);
  if (insert === null) return false;

  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
    userEvent: "input.type"
  });
  return true;
}
