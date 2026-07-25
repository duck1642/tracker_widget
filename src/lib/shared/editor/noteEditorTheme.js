import { EditorView } from "@codemirror/view";

export const noteEditorTheme = [
  EditorView.lineWrapping,
  EditorView.theme(
    {
      "&": {
        width: "100%",
        minHeight: "150px",
        background: "transparent",
        color: "var(--text-color)",
        fontSize: "13px"
      },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": {
        overflow: "visible",
        fontFamily: "var(--font-sans)",
        lineHeight: "1.6"
      },
      ".cm-content": {
        minHeight: "126px",
        padding: "12px",
        caretColor: "var(--accent)"
      },
      ".cm-line": {
        padding: "1px 0",
        overflowWrap: "anywhere",
        wordBreak: "break-word"
      },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
        backgroundColor: "color-mix(in srgb, var(--accent) 28%, transparent)"
      },
      ".cm-note-heading": {
        color: "var(--text-color)",
        fontWeight: "700",
        lineHeight: "1.35"
      },
      ".cm-note-heading-1": { fontSize: "1.45em" },
      ".cm-note-heading-2": { fontSize: "1.3em" },
      ".cm-note-heading-3": { fontSize: "1.18em" },
      ".cm-note-heading-4": { fontSize: "1.08em" },
      ".cm-note-heading-5": { fontSize: "1em" },
      ".cm-note-heading-6": { color: "var(--text-muted)", fontSize: ".92em" },
      ".cm-note-strong": { fontWeight: "700" },
      ".cm-note-emphasis": { fontStyle: "italic" },
      ".cm-note-inline-code": {
        padding: "1px 4px",
        borderRadius: "3px",
        background: "#242424",
        color: "var(--accent)",
        fontFamily: "var(--font-mono)",
        fontSize: "11px"
      },
      ".cm-note-link": {
        color: "var(--accent)",
        textDecoration: "underline",
        textUnderlineOffset: "2px"
      },
      ".cm-note-blockquote": {
        paddingLeft: "12px",
        borderLeft: "2px solid var(--accent)",
        background: "rgba(255, 255, 255, 0.02)",
        color: "var(--text-muted)",
        fontStyle: "italic"
      },
      ".cm-note-codeblock": {
        paddingLeft: "12px",
        paddingRight: "12px",
        background: "var(--surface)",
        color: "var(--text-color)",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        boxShadow: "inset 1px 0 var(--border-subtle), inset -1px 0 var(--border-subtle)"
      },
      ".cm-note-codeblock-first": {
        marginTop: "6px",
        paddingTop: "7px",
        borderRadius: "var(--radius-md) var(--radius-md) 0 0",
        boxShadow: "inset 1px 0 var(--border-subtle), inset -1px 0 var(--border-subtle), inset 0 1px var(--border-subtle)"
      },
      ".cm-note-codeblock-last": {
        marginBottom: "6px",
        paddingBottom: "7px",
        borderRadius: "0 0 var(--radius-md) var(--radius-md)",
        boxShadow: "inset 1px 0 var(--border-subtle), inset -1px 0 var(--border-subtle), inset 0 -1px var(--border-subtle)"
      },
      ".cm-note-codeblock-first.cm-note-codeblock-last": {
        borderRadius: "var(--radius-md)"
      },
      ".cm-note-bullet": {
        display: "inline-block",
        width: "1.2em",
        color: "var(--accent)",
        fontWeight: "700",
        textAlign: "center"
      },
      ".cm-note-task": {
        margin: "0 7px 0 0",
        verticalAlign: "-2px",
        accentColor: "var(--accent)",
        cursor: "pointer"
      },
      ".cm-note-rule": {
        display: "inline-block",
        width: "100%",
        height: "1px",
        margin: "8px 0 3px",
        background: "var(--border-color)",
        verticalAlign: "middle"
      }
    },
    { dark: true }
  )
];
