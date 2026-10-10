import type { EditorState, Range } from "@codemirror/state";
import type { SyntaxNode, NodeIterator } from "@lezer/common";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
type FoldRange = {from:number;to:number};
import {
  codeFolding,
  foldNodeProp,
  foldService,
  foldable,
  foldKeymap,
  foldEffect,
  unfoldEffect,
  foldedRanges,
  syntaxTree
} from "@codemirror/language";
import { RangeSet, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, GutterMarker, gutter, keymap, ViewPlugin, WidgetType } from "@codemirror/view";
import { collectNotePreviewRanges } from "./noteLivePreview.ts";
import { LIST_LINE_RE } from "./noteListPatterns.ts";

export { foldEffect, unfoldEffect, foldedRanges };

/**
 * Shared in-memory fold session store keyed by Scratchpad file path.
 * Retains fold state across tab switches, pane moves, and remounts during the app session.
 */
const scratchpadFoldStateMap: Map<string, { content: string, ranges: Array<{ from: number, to: number }> }> = new Map();

/**
 * Returns saved fold ranges for the given path if content is compatible.
 */
export function getScratchpadFoldState(path: string, content: string): Array<{ from: number, to: number }> | null {
  if (!path) return null;
  const entry = scratchpadFoldStateMap.get(path);
  if (!entry || entry.content !== content) return null;
  return entry.ranges;
}

/**
 * Saves fold snapshot for the given path and content in session memory.
 */
export function saveScratchpadFoldState(path: string, content: string, ranges: Array<{ from: number, to: number }>) {
  if (!path) return;
  scratchpadFoldStateMap.set(path, { content, ranges });
}

/**
 * Clears fold state for a path.
 */
export function clearScratchpadFoldState(path: string) {
  if (!path) return;
  scratchpadFoldStateMap.delete(path);
}

/**
 * Extracts active folded ranges from an EditorView or EditorState.
 */
export function getFoldSnapshot(target: import("@codemirror/view").EditorView | import("@codemirror/state").EditorState): Array<{ from: number, to: number }> {
  const state = "state" in target ? target.state : target;
  const folds = foldedRanges(state);

  const ranges: Array<{ from: number, to: number }> = [];
  folds.between(0, state.doc.length, (from, to) => {
    ranges.push({ from, to });
  });
  return ranges;
}

/**
 * Restores fold ranges onto an EditorView if valid within current document.
 */
export function restoreFoldSnapshot(view: import("@codemirror/view").EditorView, ranges: Array<{ from: number, to: number }> | null | undefined) {
  if (!view || !Array.isArray(ranges) || ranges.length === 0) return;
  const docLength = view.state.doc.length;
  const validEffects = ranges
    .filter((r) => {
      if (!r || typeof r.from !== "number" || typeof r.to !== "number" || r.from < 0 || r.to > docLength || r.from >= r.to) {
        return false;
      }
      const line = view.state.doc.lineAt(r.from);
      const candidates = [line];
      if (line.number > 1) candidates.push(view.state.doc.line(line.number - 1));
      return candidates.some((candidate) => {
        const current = foldable(view.state, candidate.from, candidate.to);
        return current?.from === r.from && current?.to === r.to;
      });
    })
    .map((r) => foldEffect.of({ from: r.from, to: r.to }));

  if (validEffects.length > 0) {
    view.dispatch({ effects: validEffects });
  }
}

/**
 * Checks if a syntax node type represents an ATX or Setext heading.
 */
function isHeadingType(type: import("@lezer/common").NodeType): number | null {
  const match = /^(?:ATX|Setext)Heading(\d)$/.exec(type.name);
  return match ? Number(match[1]) : null;
}

/**
 * Finds the end of a heading section up to the next heading of equal or higher level.
 */
function findSectionEnd(headerNode: import("@lezer/common").SyntaxNode, level: number): number {
  let last = headerNode;
  for (;;) {
    const next = last.nextSibling;
    let heading;
    if (!next || ((heading = isHeadingType(next.type)) !== null && heading <= level)) {
      break;
    }
    last = next;
  }
  return last.to;
}

/**
 * Heading fold service reproducing CodeMirror's Markdown section boundaries for ATX and Setext.
 */
export function headingFoldService(state: import("@codemirror/state").EditorState, start: number, end: number): { from: number, to: number } | null {
  for (let node:SyntaxNode|null = syntaxTree(state).resolveInner(end, -1); node; node = node.parent) {
    if (node.from < start && node.to <= end) break;
    const heading = isHeadingType(node.type);
    if (heading === null) continue;

    // For Setext headings, trigger only from the first line
    const startLine = state.doc.lineAt(node.from);
    if (startLine.from !== start) return null;

    const upto = findSectionEnd(node, heading);
    const foldFrom = node.to;
    if (upto > foldFrom) return { from: foldFrom, to: upto };
  }
  return null;
}

/**
 * Narrow fallback fold service for visually nested 2-space lists where native AST lacks container nodes.
 */
export function listFallbackFoldService(state: import("@codemirror/state").EditorState, start: number, end: number): { from: number, to: number } | null {
  const line = state.doc.lineAt(start);
  const match = line.text.match(LIST_LINE_RE);
  if (!match) return null;

  const tree = syntaxTree(state);
  const node = tree.resolveInner(start, 1);
  if (node && (node.name.includes("Code") || node.name === "HorizontalRule" || node.name === "QuoteMark")) {
    return null;
  }

  const parentIndent = match[1].length;
  if (line.number >= state.doc.lines) return null;

  // Find next non-blank line
  let nextLine = null;
  for (let i = line.number + 1; i <= state.doc.lines; i++) {
    const l = state.doc.line(i);
    if (l.text.trim() !== "") {
      nextLine = l;
      break;
    }
  }

  if (!nextLine) return null;
  const nextIndent = (nextLine.text.match(/^(\s*)/)?.[1] || "").length;
  if (nextIndent <= parentIndent) return null;

  let lastFoldLine = nextLine;
  for (let i = nextLine.number + 1; i <= state.doc.lines; i++) {
    const curLine = state.doc.line(i);
    const text = curLine.text;
    if (text.trim() === "") continue;

    const innerNode = tree.resolveInner(curLine.from, 1);
    if (innerNode && (innerNode.name.includes("Code") || innerNode.name === "HorizontalRule")) {
      break;
    }

    const indent = (text.match(/^(\s*)/)?.[1] || "").length;
    if (indent <= parentIndent) {
      break;
    }
    lastFoldLine = curLine;
  }

  if (lastFoldLine.number <= line.number) return null;
  return { from: end, to: lastFoldLine.to };
}

/**
 * Combined Markdown fold service: headings first, then list fallback.
 */
export function noteMarkdownFoldService(state: import("@codemirror/state").EditorState, start: number, end: number): { from: number, to: number } | null {
  const heading = headingFoldService(state, start, end);
  if (heading) return heading;
  if (hasNativeSyntaxFold(state, start, end)) return null;
  return listFallbackFoldService(state, start, end);
}

function hasNativeSyntaxFold(state:EditorState, start:number, end:number) {
  const tree = syntaxTree(state);
  if (tree.length < end) return false;

  for (let stack:NodeIterator|null = tree.resolveStack(end, 1); stack; stack = stack.next) {
    const node = stack.node;
    if (node.to <= end || node.from > end) continue;
    const fold = node.type.prop(foldNodeProp)?.(node, state);
    if (fold && fold.from >= start && fold.from <= end && fold.to > end) return true;
  }

  return false;
}

/**
 * Creates fold marker DOM for fold gutter (chevron down for open, chevron right for folded).
 */
export function createFoldMarkerDOM(open: boolean): HTMLElement {
  const marker = document.createElement("span");
  marker.className = `cm-fold-marker cm-fold-marker-${open ? "open" : "folded"}`;
  marker.setAttribute("aria-hidden", "true");
  marker.setAttribute("title", open ? "Fold section" : "Unfold section");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "13");
  svg.setAttribute("height", "13");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("shape-rendering", "geometricPrecision");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", open ? "m6 9 6 6 6-6" : "m9 18 6-6-6-6");
  svg.appendChild(path);
  marker.appendChild(svg);
  return marker;
}

function foldAtLine(state:EditorState, from:number, to:number):FoldRange|null {
  let found:FoldRange|null = null;
  foldedRanges(state).between(from, to, (foldFrom, foldTo) => {
    if (!found || foldFrom < found.from) found = { from: foldFrom, to: foldTo };
  });
  return found;
}

function listDepthsByLine(state:EditorState) {
  const depths = new Map<number,number>();
  for (const range of collectNotePreviewRanges(state, false)) {
    if (range.kind === "listLayout") depths.set(range.from, Number(range.depth) || 0);
  }
  return depths;
}

class NoteFoldGutterMarker extends GutterMarker {
  open:boolean;
  constructor(open:boolean) {
    super();
    this.open = open;
  }

  eq(other:NoteFoldGutterMarker) {
    return other.open === this.open;
  }

  toDOM() {
    return createFoldMarkerDOM(this.open);
  }
}

const openGutterMarker = new NoteFoldGutterMarker(true);
const foldedGutterMarker = new NoteFoldGutterMarker(false);

const noteFoldGutterMarkers = ViewPlugin.fromClass(
  class {
    markers:RangeSet<GutterMarker>;
    constructor(view:EditorView) {
      this.markers = this.build(view);
    }

    update(update:ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        foldedRanges(update.startState) !== foldedRanges(update.state) ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.markers = this.build(update.view);
      }
    }

    build(view:EditorView) {
      const builder = new RangeSetBuilder<GutterMarker>();
      const depths = listDepthsByLine(view.state);
      for (const block of view.viewportLineBlocks) {
        if ((depths.get(block.from) ?? 0) > 0) continue;
        const folded = foldAtLine(view.state, block.from, block.to);
        const range = folded ?? foldable(view.state, block.from, block.to);
        if (range) builder.add(block.from, block.from, folded ? foldedGutterMarker : openGutterMarker);
      }
      return builder.finish();
    }
  }
);

function createNoteFoldGutter() {
  return [
    noteFoldGutterMarkers,
    gutter({
      class: "cm-foldGutter",
      markers(view) {
        return view.plugin(noteFoldGutterMarkers)?.markers ?? RangeSet.empty;
      },
      initialSpacer() {
        return foldedGutterMarker;
      },
      domEventHandlers: {
        click(view, line) {
          if ((listDepthsByLine(view.state).get(line.from) ?? 0) > 0) return false;
          const folded = foldAtLine(view.state, line.from, line.to);
          if (folded) {
            view.dispatch({ effects: unfoldEffect.of(folded) });
            return true;
          }
          const range = foldable(view.state, line.from, line.to);
          if (!range) return false;
          view.dispatch({ effects: foldEffect.of(range) });
          return true;
        }
      }
    })
  ];
}

class ListFoldWidget extends WidgetType {
  depth:number;open:boolean;range:FoldRange;
  constructor(depth:number, open:boolean, range:FoldRange) {
    super();
    this.depth = depth;
    this.open = open;
    this.range = range;
  }

  eq(other:ListFoldWidget) {
    return other.depth === this.depth && other.open === this.open && other.range.from === this.range.from && other.range.to === this.range.to;
  }

  toDOM(view:EditorView) {
    const anchor = document.createElement("span");
    anchor.className = "cm-note-list-fold-anchor";

    const control = document.createElement("button");
    control.type = "button";
    control.className = `cm-note-list-fold-control cm-fold-marker cm-fold-marker-${this.open ? "open" : "folded"}`;
    control.style.left = "-16px";
    control.setAttribute("aria-label", this.open ? "Fold list" : "Unfold list");
    control.title = this.open ? "Fold list" : "Unfold list";

    const marker = createFoldMarkerDOM(this.open);
    control.append(...marker.childNodes);
    control.addEventListener("mousedown", (event) => event.preventDefault());
    control.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({ effects: (this.open ? foldEffect : unfoldEffect).of(this.range) });
      view.focus();
    });
    anchor.append(control);
    return anchor;
  }
}

function buildListFoldDecorations(view:EditorView) {
  const decorations:Range<Decoration>[] = [];
  for (const [lineFrom, depth] of listDepthsByLine(view.state)) {
    if (depth <= 0 || lineFrom < view.viewport.from || lineFrom > view.viewport.to) continue;
    const line = view.state.doc.lineAt(lineFrom);
    const folded = foldAtLine(view.state, line.from, line.to);
    const range = folded ?? foldable(view.state, line.from, line.to);
    if (!range) continue;
    decorations.push(
      Decoration.widget({
        widget: new ListFoldWidget(depth, !folded, range),
        side: -1
      }).range(line.from)
    );
  }
  return Decoration.set(decorations, true);
}

const noteListFoldControls = ViewPlugin.fromClass(
  class {
    decorations:DecorationSet;
    constructor(view:EditorView) {
      this.decorations = buildListFoldDecorations(view);
    }

    update(update:ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        foldedRanges(update.startState) !== foldedRanges(update.state) ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = buildListFoldDecorations(update.view);
      }
    }
  },
  { decorations: (value) => value.decorations }
);

/**
 * Creates the clickable ellipsis shown in place of folded content.
 */
export function createFoldPlaceholderDOM(view:Pick<EditorView,"state"> | null, onclick:((event:MouseEvent)=>void) | null): HTMLElement {
  const placeholder = document.createElement("span");
  placeholder.className = "cm-foldPlaceholder";
  placeholder.textContent = "...";
  placeholder.setAttribute("aria-label", view?.state.phrase("folded code") ?? "Folded content");
  placeholder.title = view?.state.phrase("unfold") ?? "Unfold";
  if (onclick) placeholder.onclick = onclick;
  return placeholder;
}

/**
 * Scratchpad-only folding geometry. The gutter sits outside the editor's
 * unchanged 12px content inset, with extra right space for visual balance.
 */
export const noteFoldingTheme = EditorView.theme({
  ".cm-gutters": {
    background: "transparent",
    border: "none"
  },
  ".cm-gutter.cm-foldGutter": {
    width: "24px",
    minWidth: "24px",
    maxWidth: "24px",
    background: "transparent",
    border: "none",
    padding: "0"
  },
  ".cm-foldGutter .cm-gutterElement": {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    width: "24px !important",
    padding: "0 !important"
  },
  ".cm-scroller > .cm-content": {
    padding: "12px 24px 12px 0"
  },
  ".cm-fold-marker": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "20px",
    marginLeft: "8px",
    padding: "0",
    border: "0",
    borderRadius: "3px",
    background: "transparent",
    cursor: "pointer",
    color: "var(--text-muted)",
    transition: "color 0.15s ease, opacity 0.15s ease",
    userSelect: "none"
  },
  ".cm-fold-marker-open": {
    opacity: "0"
  },
  ".cm-foldGutter .cm-gutterElement:hover .cm-fold-marker-open": {
    opacity: "1"
  },
  ".cm-note-list-fold-anchor": {
    display: "inline-block",
    position: "relative",
    width: "0",
    height: "0",
    verticalAlign: "top"
  },
  ".cm-note-list-fold-control": {
    position: "absolute",
    top: "2px",
    zIndex: "2",
    marginLeft: "0",
    font: "inherit"
  },
  ".cm-line:hover .cm-note-list-fold-control.cm-fold-marker-open": {
    opacity: "1"
  },
  ".cm-fold-marker:hover": {
    color: "var(--accent)"
  },
  ".cm-fold-marker-folded": {
    opacity: "1",
    color: "var(--accent)"
  },
  ".cm-fold-marker svg": {
    display: "block",
    width: "13px",
    height: "13px"
  },
  ".cm-foldPlaceholder": {
    display: "inline",
    margin: "0 2px",
    padding: "0",
    border: "0",
    borderRadius: "0",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: ".9em",
    letterSpacing: "1px",
    lineHeight: "inherit",
    cursor: "pointer",
    verticalAlign: "baseline"
  },
  ".cm-foldPlaceholder:hover": {
    borderColor: "var(--accent)",
    color: "var(--accent)"
  }
});

/**
 * Complete Scratchpad folding extension bundle.
 */
export function createNoteFoldingExtension() {
  return [
    codeFolding({
      placeholderDOM: createFoldPlaceholderDOM
    }),
    createNoteFoldGutter(),
    noteListFoldControls,
    foldService.of(noteMarkdownFoldService),
    keymap.of(foldKeymap),
    noteFoldingTheme
  ];
}
