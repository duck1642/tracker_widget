// @ts-nocheck
import { ChangeSet } from "@codemirror/state";
import { insertNewlineContinueMarkupCommand } from "@codemirror/lang-markdown";

const continueMarkdownMarkup = insertNewlineContinueMarkupCommand({
  nonTightLists: false
});

export function continueNoteMarkdownList({ state, dispatch }) {
  if (state.selection.ranges.length !== 1 || !state.selection.main.empty) {
    return continueMarkdownMarkup({ state, dispatch });
  }

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
