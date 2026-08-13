import { syntaxTree } from "@codemirror/language";
import { markdownLanguage } from "@codemirror/lang-markdown";
import { Annotation, EditorSelection, Transaction } from "@codemirror/state";
import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";
import { LIST_MARKER_LOOSE_RE } from "./noteListPatterns.js";

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

/** @param {import("@lezer/common").SyntaxNode} listItem */
function listItemContentEnd(listItem) {
  for (let child = listItem.firstChild; child; child = child.nextSibling) {
    if (child.name === "BulletList" || child.name === "OrderedList") return child.from;
  }
  return listItem.to;
}

/** @param {string} source @param {import("@lezer/common").SyntaxNode} listItem @param {number} markerEnd */
function listItemHasContent(source, listItem, markerEnd) {
  return source.slice(markerEnd, listItemContentEnd(listItem)).trim().length > 0;
}

/**
 * Uses the parser tree where possible, then preserves common two-space/tab
 * nesting that CodeMirror keeps in one list/paragraph node.
 * @param {import("@lezer/common").SyntaxNode} listItem
 * @param {import("@codemirror/state").EditorState} state
 * @param {number} markerFrom
 */
function listItemDepth(listItem, state, markerFrom) {
  let structuralDepth = 0;
  for (let parent = listItem.parent; parent; parent = parent.parent) {
    if (parent.name === "BulletList" || parent.name === "OrderedList") structuralDepth += 1;
  }

  const line = state.doc.lineAt(markerFrom);
  const sourceIndent = state.sliceDoc(line.from, markerFrom).replace(/\t/g, "  ").length;
  return Math.max(0, structuralDepth - 1, Math.floor(sourceIndent / 2));
}

/** @param {number} depth @param {boolean} task @param {boolean} ordered */
function listLayoutStyle(depth, task, ordered) {
  const positions = Array.from({ length: depth }, (_, index) => `calc(${index * 20}px + .525em) 0px`);
  const guide = "linear-gradient(to bottom, var(--border-subtle), var(--border-subtle))";
  const prefix = task ? "24px" : ordered ? "calc(1.2em + 6px)" : "calc(.75em + 6px)";

  return [
    `--cm-note-list-depth: ${depth * 20}px`,
    `--cm-note-list-prefix: ${prefix}`,
    "padding-left: calc(var(--cm-note-list-depth) + var(--cm-note-list-prefix))",
    "text-indent: calc(-1 * var(--cm-note-list-prefix))",
    ...(depth > 0
      ? [
          `background-image: ${Array(depth).fill(guide).join(", ")}`,
          `background-position: ${positions.join(", ")}`,
          `background-size: ${Array(depth).fill("1px 100%").join(", ")}`,
          `background-repeat: ${Array(depth).fill("no-repeat").join(", ")}`
        ]
      : [])
  ].join("; ");
}

/**
 * Computes visual list ordinal for Live Preview display.
 * @param {import("@codemirror/state").EditorState} state
 * @param {number} lineNo
 * @param {string} rawMarker
 */
function calculateVisualOrdinal(state, lineNo, rawMarker) {
  const currentLine = state.doc.line(lineNo);
  const currentIndent = (currentLine.text.match(/^(\s*)/)?.[1] || "").length;
  const delimiter = rawMarker.slice(-1);
  let ordinal = 1;
  let blankCount = 0;

  for (let p = lineNo - 1; p >= 1; p -= 1) {
    const line = state.doc.line(p);
    const text = line.text;

    if (text.trim() === "") {
      blankCount += 1;
      // CommonMark: two consecutive blank lines end a list context
      if (blankCount >= 2) break;
      continue;
    }

    const match = text.match(LIST_MARKER_LOOSE_RE);
    if (!match) {
      break;
    }

    blankCount = 0;
    const prevIndent = match[1].length;
    const prevMarker = match[2];
    const isPrevOrdered = /^\d+[.)]$/.test(prevMarker);

    if (!isPrevOrdered) {
      if (prevIndent <= currentIndent) break;
      continue;
    }

    if (prevIndent < currentIndent) {
      break;
    } else if (prevIndent === currentIndent) {
      ordinal += 1;
    }
  }

  return `${ordinal}${delimiter}`;
}

/**
 * Handles ordered-looking continuation lines that the Markdown parser keeps
 * inside a paragraph/bullet item (e.g. 2-space indented sub-lists).
 * @param {import("@codemirror/state").EditorState} state
 * @param {import("@lezer/common").SyntaxNode} paragraph
 * @param {boolean} selectionActive
 */
function bulletParagraphOrderedMarkers(state, paragraph, selectionActive) {
  const ranges = [];
  const firstLine = state.doc.lineAt(paragraph.from).number;
  const lastLine = state.doc.lineAt(Math.max(paragraph.from, paragraph.to - 1)).number;

  for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const match = /^(\s*)(\d+)([.)])[ \t]+(?=\S)/.exec(line.text);
    if (!match) continue;

    const indent = match[1].length;
    if (indent === 0 && paragraph.parent?.name !== "ListItem") continue;

    const from = line.from + match[1].length;
    const to = from + match[2].length + match[3].length;
    if (syntaxTree(state).resolveInner(from, 1).name === "ListMark") continue;

    const rawMarker = match[2] + match[3];
    const markerText = calculateVisualOrdinal(state, lineNumber, rawMarker);
    const depth = Math.floor(indent / 2);

    if (line.from < from) {
      ranges.push({ kind: "listIndent", from: line.from, to: from });
    }

    ranges.push({
      kind: "listMarker",
      from,
      to,
      marker: markerText,
      ordered: true,
      depth
    });

    ranges.push({
      kind: "listLayout",
      from: line.from,
      to: line.from,
      depth,
      task: false,
      ordered: true
    });

    ranges.push({ kind: "hide", from: to, to: to + 1 });
  }

  return ranges;
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

  // Linear scan is fine — typical documents produce <100 ranges.
  /** @param {any} range */
  const pushRange = (range) => {
    if (ranges.some((r) => r.from === range.from && r.to === range.to && r.kind === range.kind)) return;
    ranges.push(range);
  };

  syntaxTree(state).iterate({
    enter(ref) {
      const { name } = ref.type;
      const node = ref.node;
      const active = selectionActive && constructIsActive(state, node);

      if (/^ATXHeading[1-6]$/.test(name)) {
        pushRange({
          kind: "heading",
          from: ref.from,
          to: ref.to,
          level: Number(name.at(-1))
        });
        return;
      }

      if (name === "StrongEmphasis") {
        pushRange({ kind: "strong", from: ref.from, to: ref.to });
        return;
      }

      if (name === "Emphasis") {
        pushRange({ kind: "emphasis", from: ref.from, to: ref.to });
        return;
      }

      if (name === "InlineCode") {
        pushRange({ kind: "inlineCode", from: ref.from, to: ref.to });
        return;
      }

      if (name === "Blockquote") {
        pushRange({ kind: "blockquote", from: ref.from, to: ref.to });
        return;
      }

      if (name === "FencedCode") {
        const info = node.getChild("CodeInfo");
        pushRange({
          kind: "codeblock",
          from: ref.from,
          to: ref.to,
          language: info ? source.slice(info.from, info.to) : ""
        });
        return;
      }

      if (name === "Paragraph") {
        const paraRanges = bulletParagraphOrderedMarkers(state, node, selectionActive);
        for (const r of paraRanges) pushRange(r);
        return;
      }

      if (name === "HeaderMark" && !active) {
        pushRange({ kind: "hide", ...includeFollowingSpace(source, ref.from, ref.to) });
        return;
      }

      if ((name === "EmphasisMark" || name === "CodeMark" || name === "CodeInfo") && !active) {
        pushRange({ kind: "hide", from: ref.from, to: ref.to });
        return;
      }

      if (name === "QuoteMark" && !active) {
        pushRange({ kind: "hide", ...includeFollowingSpace(source, ref.from, ref.to) });
        return;
      }

      if (name === "ListMark") {
        const listItem = syntaxConstruct(node);
        if (listItem?.name !== "ListItem") return;

        const task = listItem.getChild("Task");
        const hasContent = listItemHasContent(source, listItem, ref.to);
        const hasFollowingSpace = /[ \t]/.test(source[ref.to] || "");
        const line = state.doc.lineAt(ref.from);
        const depth = listItemDepth(listItem, state, ref.from);

        if (task || hasContent || hasFollowingSpace) {
          const rawMarker = source.slice(ref.from, ref.to);
          const isOrdered = /^\d+[.)]$/.test(rawMarker);
          const lineNo = state.doc.lineAt(ref.from).number;
          const markerText = isOrdered ? calculateVisualOrdinal(state, lineNo, rawMarker) : rawMarker;

          pushRange({
            kind: "listLayout",
            from: line.from,
            to: line.from,
            depth,
            task: Boolean(task),
            ordered: isOrdered
          });

          if (/[ \t]/.test(source[ref.to] || "")) {
            pushRange({ kind: "hide", from: ref.to, to: ref.to + 1 });
          }

          if (task) {
            pushRange({ kind: "listIndent", from: line.from, to: task.from });
            return;
          }

          if (line.from < ref.from) {
            pushRange({ kind: "listIndent", from: line.from, to: ref.from });
          }

          pushRange({
            kind: "listMarker",
            from: ref.from,
            to: ref.to,
            marker: markerText,
            ordered: isOrdered,
            depth
          });
        }
        return;
      }

      if (name === "TaskMarker") {
        let listItem = node.parent;
        while (listItem && listItem.name !== "ListItem") listItem = listItem.parent;
        pushRange({
          kind: "task",
          from: ref.from,
          to: ref.to,
          checked: /\[[xX]\]/.test(source.slice(ref.from, ref.to)),
          depth: listItem ? listItemDepth(listItem, state, ref.from) : 0
        });
        return;
      }

      if (name === "Link") {
        const raw = source.slice(ref.from, ref.to);
        const match = raw.match(/^\[([^\]]*)\]\(([^)]*)\)$/s);
        if (match) {
          pushRange({
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
        pushRange({ kind: "hide", from: ref.from, to: ref.to });
        return;
      }

      if (name === "HorizontalRule" && !(selectionActive && selectionIntersectsRange(state, ref.from, ref.to))) {
        pushRange({ kind: "rule", from: ref.from, to: ref.to });
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
  const current = state.doc.toString();
  if (current === value) return null;

  let prefix = 0;
  while (prefix < current.length && prefix < value.length && current[prefix] === value[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < current.length - prefix &&
    suffix < value.length - prefix &&
    current[current.length - 1 - suffix] === value[value.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const selection = EditorSelection.create(
    state.selection.ranges.map((range) =>
      EditorSelection.range(
        Math.min(range.anchor, value.length),
        Math.min(range.head, value.length)
      )
    ),
    state.selection.mainIndex
  );

  return {
    changes: {
      from: prefix,
      to: current.length - suffix,
      insert: value.slice(prefix, value.length - suffix)
    },
    selection,
    annotations: [
      Transaction.addToHistory.of(false),
      externalDocumentAnnotation.of(true)
    ]
  };
}

class ListMarkerWidget extends WidgetType {
  constructor(
    /** @type {string} */ marker,
    /** @type {boolean} */ ordered,
    /** @type {number} */ depth
  ) {
    super();
    this.marker = marker;
    this.ordered = ordered;
    this.depth = depth;
  }

  /** @param {ListMarkerWidget} other */
  eq(other) {
    return other.marker === this.marker && other.ordered === this.ordered && other.depth === this.depth;
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = `cm-note-list-marker cm-note-list-marker-${this.ordered ? "ordered" : "unordered"}`;
    marker.setAttribute("aria-hidden", "true");
    marker.style.marginLeft = "0";
    marker.textContent = this.ordered ? this.marker : "•";
    return marker;
  }
}

class TaskWidget extends WidgetType {
  constructor(
    /** @type {number} */ from,
    /** @type {number} */ to,
    /** @type {boolean} */ checked,
    /** @type {number} */ depth
  ) {
    super();
    this.from = from;
    this.to = to;
    this.checked = checked;
    this.depth = depth;
  }

  /** @param {TaskWidget} other */
  eq(other) {
    return other.from === this.from && other.to === this.to && other.checked === this.checked && other.depth === this.depth;
  }

  /** @param {import("@codemirror/view").EditorView} view */
  toDOM(view) {
    const checkbox = document.createElement("button");
    checkbox.type = "button";
    checkbox.className = `custom-check-btn cm-note-task${this.checked ? " checked" : ""}`;
    checkbox.style.marginLeft = "0";
    checkbox.setAttribute("role", "checkbox");
    checkbox.setAttribute("aria-checked", String(this.checked));
    checkbox.setAttribute("aria-label", this.checked ? "Mark task incomplete" : "Mark task complete");
    checkbox.title = this.checked ? "Mark active" : "Mark completed";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "10");
    svg.setAttribute("height", "10");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "3");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("shape-rendering", "geometricPrecision");
    svg.setAttribute("aria-hidden", "true");
    if (!this.checked) svg.style.visibility = "hidden";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M20 6 9 17l-5-5");
    svg.append(path);
    checkbox.append(svg);

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
    if (range.kind === "hide" || range.kind === "listIndent") {
      decorations.push(Decoration.replace({}).range(range.from, range.to));
    } else if (range.kind === "listLayout") {
      decorations.push(
        Decoration.line({
          attributes: {
            class: "cm-note-list-layout",
            style: listLayoutStyle(Number(range.depth), Boolean(range.task), Boolean(range.ordered))
          }
        }).range(range.from)
      );
    } else if (range.kind === "listMarker") {
      decorations.push(
        Decoration.replace({
          widget: new ListMarkerWidget(String(range.marker), Boolean(range.ordered), Number(range.depth) || 0)
        }).range(range.from, range.to)
      );
    } else if (range.kind === "task") {
      decorations.push(
        Decoration.replace({
          widget: new TaskWidget(range.from, range.to, Boolean(range.checked), Number(range.depth) || 0)
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
        const lineClasses = [className];
        if (range.kind === "codeblock") {
          if (line.from === view.state.doc.lineAt(range.from).from) {
            lineClasses.push("cm-note-codeblock-first");
          }
          if (line.to >= range.to) {
            lineClasses.push("cm-note-codeblock-last");
          }
        }
        decorations.push(
          Decoration.line({ attributes: { class: lineClasses.join(" ") } }).range(line.from)
        );
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
