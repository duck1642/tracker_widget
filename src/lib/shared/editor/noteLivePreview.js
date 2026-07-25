import { syntaxTree } from "@codemirror/language";
import { markdownLanguage } from "@codemirror/lang-markdown";
import { Annotation, Transaction } from "@codemirror/state";
import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";

const syntaxParentNames = new Set([
  "ATXHeading1",
  "ATXHeading2",
  "ATXHeading3",
  "ATXHeading4",
  "ATXHeading5",
  "ATXHeading6",
  "StrongEmphasis",
  "Emphasis",
  "InlineCode",
  "FencedCode",
  "Blockquote",
  "ListItem",
  "Task",
  "Link"
]);

export const externalDocumentAnnotation = Annotation.define();

export function createNoteMarkdownExtension() {
  return markdownLanguage;
}

/** @param {import("@codemirror/state").EditorState} state @param {number} from @param {number} to */
export function selectionIntersectsRange(state, from, to) {
  return state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

/** @param {import("@lezer/common").SyntaxNode | null} node */
function syntaxConstruct(node) {
  let current = node;
  while (current && !syntaxParentNames.has(current.name)) current = current.parent;
  return current;
}

/** @param {import("@codemirror/state").EditorState} state @param {import("@lezer/common").SyntaxNode | null} node */
function constructIsActive(state, node) {
  const construct = syntaxConstruct(node);
  return Boolean(construct && selectionIntersectsRange(state, construct.from, construct.to));
}

/** @param {string} source @param {number} from @param {number} to */
function includeFollowingSpace(source, from, to) {
  return source[to] === " " ? { from, to: to + 1 } : { from, to };
}

/**
 * Produces source-range decisions independently from CodeMirror DOM decorations.
 * @param {import("@codemirror/state").EditorState} state
 * @param {boolean} selectionActive
 */
export function collectNotePreviewRanges(state, selectionActive = true) {
  const source = state.doc.toString();
  /** @type {Array<{ kind: string, from: number, to: number, [key: string]: unknown }>} */
  const ranges = [];

  syntaxTree(state).iterate({
    enter(ref) {
      const { name } = ref.type;
      const node = ref.node;
      const active = selectionActive && constructIsActive(state, node);

      if (/^ATXHeading[1-6]$/.test(name)) {
        ranges.push({
          kind: "heading",
          from: ref.from,
          to: ref.to,
          level: Number(name.at(-1))
        });
        return;
      }

      if (name === "StrongEmphasis") {
        ranges.push({ kind: "strong", from: ref.from, to: ref.to });
        return;
      }

      if (name === "Emphasis") {
        ranges.push({ kind: "emphasis", from: ref.from, to: ref.to });
        return;
      }

      if (name === "InlineCode") {
        ranges.push({ kind: "inlineCode", from: ref.from, to: ref.to });
        return;
      }

      if (name === "Blockquote") {
        ranges.push({ kind: "blockquote", from: ref.from, to: ref.to });
        return;
      }

      if (name === "FencedCode") {
        const info = node.getChild("CodeInfo");
        ranges.push({
          kind: "codeblock",
          from: ref.from,
          to: ref.to,
          language: info ? source.slice(info.from, info.to) : ""
        });
        return;
      }

      if (name === "HeaderMark" && !active) {
        ranges.push({ kind: "hide", ...includeFollowingSpace(source, ref.from, ref.to) });
        return;
      }

      if ((name === "EmphasisMark" || name === "CodeMark" || name === "CodeInfo") && !active) {
        ranges.push({ kind: "hide", from: ref.from, to: ref.to });
        return;
      }

      if (name === "QuoteMark" && !active) {
        ranges.push({ kind: "hide", ...includeFollowingSpace(source, ref.from, ref.to) });
        return;
      }

      if (name === "ListMark" && !active) {
        const listItem = syntaxConstruct(node);
        const task = listItem?.name === "ListItem" ? listItem.getChild("Task") : null;
        ranges.push({
          kind: task ? "hide" : "bullet",
          ...includeFollowingSpace(source, ref.from, ref.to)
        });
        return;
      }

      if (name === "TaskMarker" && !active) {
        ranges.push({
          kind: "task",
          from: ref.from,
          to: ref.to,
          checked: /\[[xX]\]/.test(source.slice(ref.from, ref.to))
        });
        return;
      }

      if (name === "Link") {
        const raw = source.slice(ref.from, ref.to);
        const match = raw.match(/^\[([^\]]*)\]\(([^)]*)\)$/s);
        if (match) {
          ranges.push({
            kind: "link",
            from: ref.from,
            to: ref.to,
            label: match[1],
            destination: match[2],
            labelFrom: ref.from + 1,
            labelTo: ref.from + 1 + match[1].length
          });
        }
        return;
      }

      if ((name === "LinkMark" || name === "URL") && !active) {
        ranges.push({ kind: "hide", from: ref.from, to: ref.to });
        return;
      }

      if (name === "HorizontalRule" && !(selectionActive && selectionIntersectsRange(state, ref.from, ref.to))) {
        ranges.push({ kind: "rule", from: ref.from, to: ref.to });
      }
    }
  });

  return ranges;
}

/** @param {import("@codemirror/state").EditorState} state @param {number} from @param {number} to */
export function taskMarkerChange(state, from, to) {
  const marker = state.sliceDoc(from, to);
  const insert = /\[[xX]\]/.test(marker) ? "[ ]" : "[x]";
  return { from, to, insert };
}

/** @param {import("@codemirror/state").EditorState} state @param {string} value */
export function externalDocumentUpdate(state, value) {
  if (state.doc.toString() === value) return null;

  return {
    changes: { from: 0, to: state.doc.length, insert: value },
    selection: { anchor: Math.min(state.selection.main.head, value.length) },
    annotations: [
      Transaction.addToHistory.of(false),
      externalDocumentAnnotation.of(true)
    ]
  };
}

class BulletWidget extends WidgetType {
  toDOM() {
    const bullet = document.createElement("span");
    bullet.className = "cm-note-bullet";
    bullet.textContent = "•";
    bullet.setAttribute("aria-hidden", "true");
    return bullet;
  }
}

class TaskWidget extends WidgetType {
  constructor(
    /** @type {number} */ from,
    /** @type {number} */ to,
    /** @type {boolean} */ checked
  ) {
    super();
    this.from = from;
    this.to = to;
    this.checked = checked;
  }

  /** @param {TaskWidget} other */
  eq(other) {
    return other.from === this.from && other.to === this.to && other.checked === this.checked;
  }

  /** @param {import("@codemirror/view").EditorView} view */
  toDOM(view) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "cm-note-task";
    checkbox.checked = this.checked;
    checkbox.setAttribute("aria-label", this.checked ? "Mark task incomplete" : "Mark task complete");
    checkbox.addEventListener("mousedown", (event) => event.preventDefault());
    checkbox.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        changes: taskMarkerChange(view.state, this.from, this.to),
        annotations: Transaction.userEvent.of("input.task")
      });
      view.focus();
    });
    return checkbox;
  }
}

class RuleWidget extends WidgetType {
  toDOM() {
    const rule = document.createElement("span");
    rule.className = "cm-note-rule";
    rule.setAttribute("role", "separator");
    return rule;
  }
}

/** @param {import("@codemirror/view").EditorView} view */
function buildNoteDecorations(view) {
  /** @type {any[]} */
  const decorations = [];

  for (const range of /** @type {any[]} */ (collectNotePreviewRanges(view.state, view.hasFocus))) {
    if (range.kind === "hide") {
      decorations.push(Decoration.replace({}).range(range.from, range.to));
    } else if (range.kind === "bullet") {
      decorations.push(Decoration.replace({ widget: new BulletWidget() }).range(range.from, range.to));
    } else if (range.kind === "task") {
      decorations.push(
        Decoration.replace({
          widget: new TaskWidget(range.from, range.to, Boolean(range.checked))
        }).range(range.from, range.to)
      );
    } else if (range.kind === "rule") {
      decorations.push(
        Decoration.replace({ widget: new RuleWidget() }).range(range.from, range.to)
      );
    } else if (range.kind === "heading") {
      const line = view.state.doc.lineAt(range.from);
      decorations.push(
        Decoration.line({
          attributes: { class: `cm-note-heading cm-note-heading-${range.level}` }
        }).range(line.from)
      );
    } else if (range.kind === "blockquote" || range.kind === "codeblock") {
      const className = range.kind === "blockquote" ? "cm-note-blockquote" : "cm-note-codeblock";
      let line = view.state.doc.lineAt(range.from);
      while (line.from <= range.to) {
        decorations.push(Decoration.line({ attributes: { class: className } }).range(line.from));
        if (line.to >= range.to || line.number >= view.state.doc.lines) break;
        line = view.state.doc.line(line.number + 1);
      }
    } else if (range.kind === "strong") {
      decorations.push(Decoration.mark({ class: "cm-note-strong" }).range(range.from, range.to));
    } else if (range.kind === "emphasis") {
      decorations.push(Decoration.mark({ class: "cm-note-emphasis" }).range(range.from, range.to));
    } else if (range.kind === "inlineCode") {
      decorations.push(Decoration.mark({ class: "cm-note-inline-code" }).range(range.from, range.to));
    } else if (range.kind === "link" && range.labelFrom < range.labelTo) {
      decorations.push(
        Decoration.mark({
          class: "cm-note-link",
          attributes: range.destination ? { title: String(range.destination) } : {}
        }).range(range.labelFrom, range.labelTo)
      );
    }
  }

  return Decoration.set(decorations, true);
}

export const noteLivePreview = ViewPlugin.fromClass(
  class {
    constructor(/** @type {import("@codemirror/view").EditorView} */ view) {
      this.decorations = buildNoteDecorations(view);
    }

    update(/** @type {import("@codemirror/view").ViewUpdate} */ update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged) {
        this.decorations = buildNoteDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
);
