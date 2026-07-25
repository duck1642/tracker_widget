/**
 * @typedef {{ raw: string, index: number, start: number, end: number }} NoteLine
 * @typedef {{
 *   type: string,
 *   index: number,
 *   start: number,
 *   end: number,
 *   raw: string,
 *   content?: string,
 *   contentStart?: number,
 *   level?: number,
 *   checked?: boolean,
 *   indent?: number,
 *   marker?: string,
 *   language?: string,
 *   fenceLength?: number,
 *   closed?: boolean
 * }} NoteBlock
 */

/** @param {string} markdown @returns {NoteLine[]} */
function lineRecords(markdown) {
  const lines = String(markdown ?? "").split("\n");
  let offset = 0;

  return lines.map((raw, index) => {
    const line = {
      raw,
      index,
      start: offset,
      end: offset + raw.length
    };
    offset = line.end + (index < lines.length - 1 ? 1 : 0);
    return line;
  });
}

/** @param {string} raw @param {number} markerLength */
function inlineContentStart(raw, markerLength = 0) {
  return raw.length - raw.trimStart().length + markerLength;
}

/**
 * Parse the small Markdown subset supported by Tracker notes.
 * Every block retains its exact raw source range so the editor can replace only
 * the active block while leaving surrounding Markdown untouched.
 */
/** @param {string} markdown @returns {NoteBlock[]} */
export function parseNoteMarkdown(markdown) {
  const source = String(markdown ?? "");
  const lines = lineRecords(source);
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.raw.trim();
    const fenceStart = /^(\s*)(`{3,})([^`]*)$/.exec(line.raw);

    if (fenceStart) {
      const fenceLength = fenceStart[2].length;
      let closingIndex = -1;

      for (let candidate = index + 1; candidate < lines.length; candidate += 1) {
        const closing = /^\s*(`{3,})\s*$/.exec(lines[candidate].raw);
        if (closing && closing[1].length >= fenceLength) {
          closingIndex = candidate;
          break;
        }
      }

      const lastIndex = closingIndex >= 0 ? closingIndex : lines.length - 1;
      const lastLine = lines[lastIndex];
      const contentLines = lines.slice(index + 1, closingIndex >= 0 ? closingIndex : lines.length);
      blocks.push({
        type: "codeblock",
        index: line.index,
        start: line.start,
        end: lastLine.end,
        raw: source.slice(line.start, lastLine.end),
        content: contentLines.map((item) => item.raw).join("\n"),
        contentStart: line.raw.length + (index < lines.length - 1 ? 1 : 0),
        language: fenceStart[3].trim(),
        fenceLength,
        closed: closingIndex >= 0
      });
      index = lastIndex;
      continue;
    }

    const base = {
      index: line.index,
      start: line.start,
      end: line.end,
      raw: line.raw
    };
    const heading = /^(\s*)(#{1,6})\s+(.+?)\s*$/.exec(line.raw);
    if (heading) {
      blocks.push({
        ...base,
        type: "heading",
        level: heading[2].length,
        content: heading[3].replace(/\s+#+\s*$/, ""),
        contentStart: heading[1].length + heading[2].length + 1
      });
      continue;
    }

    const checkbox = /^(\s*)-\s+\[([ xX])\]\s+(.*)$/.exec(line.raw);
    if (checkbox) {
      blocks.push({
        ...base,
        type: "checkbox",
        checked: checkbox[2].toLowerCase() === "x",
        content: checkbox[3],
        indent: checkbox[1].length * 12,
        contentStart: inlineContentStart(line.raw, line.raw.slice(checkbox[1].length).indexOf(checkbox[3]))
      });
      continue;
    }

    const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line.raw);
    if (bullet) {
      blocks.push({
        ...base,
        type: "bullet",
        content: bullet[2],
        indent: bullet[1].length * 12,
        contentStart: bullet[1].length + 2
      });
      continue;
    }

    const ordered = /^(\s*)(\d+)([.)])\s+(.*)$/.exec(line.raw);
    if (ordered) {
      const marker = `${ordered[2]}${ordered[3]}`;
      blocks.push({
        ...base,
        type: "ordered",
        marker,
        content: ordered[4],
        indent: ordered[1].length * 12,
        contentStart: ordered[1].length + marker.length + 1
      });
      continue;
    }

    const blockquote = /^(\s*)>\s+(.*)$/.exec(line.raw);
    if (blockquote) {
      blocks.push({
        ...base,
        type: "blockquote",
        content: blockquote[2],
        indent: blockquote[1].length * 12,
        contentStart: blockquote[1].length + 2
      });
      continue;
    }

    if (trimmed === "---") {
      blocks.push({ ...base, type: "hr", contentStart: 0 });
      continue;
    }

    if (trimmed === "") {
      blocks.push({ ...base, type: "blank", contentStart: 0 });
      continue;
    }

    blocks.push({
      ...base,
      type: "paragraph",
      content: line.raw,
      contentStart: line.raw.length - line.raw.trimStart().length
    });
  }

  return blocks;
}

/** @param {NoteBlock[]} blocks @param {number} offset @returns {NoteBlock | null} */
export function noteBlockAtOffset(blocks, offset) {
  const exactStart = blocks.find((block) => block.start === offset);
  if (exactStart) return exactStart;
  return blocks.find((block) => offset >= block.start && offset <= block.end) ?? null;
}

/** @param {string} markdown @param {NoteBlock} block @param {string} raw */
export function replaceNoteBlock(markdown, block, raw) {
  const source = String(markdown ?? "");
  return `${source.slice(0, block.start)}${raw}${source.slice(block.end)}`;
}

/** @param {string} markdown @param {NoteBlock | null | undefined} block */
export function toggleNoteCheckbox(markdown, block) {
  if (block?.type !== "checkbox") return String(markdown ?? "");
  const replacement = block.checked
    ? block.raw.replace(/^(\s*)-\s+\[[xX]\]/, "$1- [ ]")
    : block.raw.replace(/^(\s*)-\s+\[ \]/, "$1- [x]");
  return replaceNoteBlock(markdown, block, replacement);
}
