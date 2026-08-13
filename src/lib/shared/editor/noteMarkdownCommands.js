import { ChangeSet } from "@codemirror/state";
import { insertNewlineContinueMarkupCommand } from "@codemirror/lang-markdown";
import { LIST_MARKER_LOOSE_RE } from "./noteListPatterns.js";

const continueMarkdownMarkup = insertNewlineContinueMarkupCommand({
  nonTightLists: false
});

/**
 * Continues Markdown list markup on Enter and removes only the spacer that
 * CodeMirror creates when leaving a loose list.
 * @param {{ state: import("@codemirror/state").EditorState, dispatch: (tr: import("@codemirror/state").Transaction) => void }} params
 * @returns {boolean}
 */
export function continueNoteMarkdownList({ state, dispatch }) {
  const line = state.doc.lineAt(state.selection.main.head);
  if (!LIST_MARKER_LOOSE_RE.test(line.text)) return false;

  /** @type {import("@codemirror/state").Transaction | undefined} */
  let continuation;
  const handled = continueMarkdownMarkup({
    state,
    dispatch: (transaction) => {
      continuation = transaction;
    }
  });

  if (!handled || !continuation) return false;

  const oldLine = state.doc.lineAt(state.selection.main.head);
  const newLine = continuation.newDoc.lineAt(continuation.newSelection.main.head);

  if (newLine.number !== oldLine.number + 2) {
    dispatch(continuation);
    return true;
  }

  const spacer = continuation.newDoc.line(newLine.number - 1);
  if (!/^[\s>]*$/.test(spacer.text)) {
    dispatch(continuation);
    return true;
  }

  const collapseSpacer = ChangeSet.of(
    { from: spacer.from, to: newLine.from },
    continuation.newDoc.length
  );

  dispatch(state.update({
    changes: continuation.changes.compose(collapseSpacer),
    selection: continuation.newSelection.map(collapseSpacer),
    scrollIntoView: true,
    userEvent: "input"
  }));
  return true;
}
