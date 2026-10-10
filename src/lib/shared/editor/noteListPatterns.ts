/**
 * Shared regex patterns for Markdown list-line detection.
 *
 * Both Live Preview (noteLivePreview.js) and editing commands
 * (noteMarkdownCommands.js) need to identify list lines.
 * Centralising the patterns here prevents capture-group drift.
 */

/**
 * Matches any list line: ordered (`1.`, `2)`), or unordered (`-`, `*`, `+`).
 *
 * Capture groups:
 *  [1] leading whitespace (indent)
 *  [2] full marker (`3.`, `7)`, `-`, `*`, `+`)
 *  [3] trailing whitespace after the marker
 */
export const LIST_LINE_RE = /^(\s*)(\d+[.)]|-|\*|\+)(\s+)/;

/**
 * Matches an ordered list line, splitting the number from its delimiter.
 *
 * Capture groups:
 *  [1] leading whitespace (indent)
 *  [2] digits only (`3`, `12`)
 *  [3] delimiter (`.` or `)`)
 *  [4] trailing whitespace after the delimiter
 */
export const ORDERED_LINE_RE = /^(\s*)(\d+)([.)])(\s+)/;

/**
 * Matches any list marker (ordered or unordered) allowing an end-of-line
 * instead of requiring trailing whitespace. Used when scanning backward
 * through preceding lines where the marker may be the only content.
 *
 * Capture groups:
 *  [1] leading whitespace (indent)
 *  [2] full marker
 */
export const LIST_MARKER_LOOSE_RE = /^(\s*)(\d+[.)]|-|\*|\+)(?:\s+|$)/;
