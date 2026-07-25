// @ts-nocheck

function trimBoundaryNewlines(value) {
  return String(value ?? "").replace(/^(?:\r\n|\n|\r)+|(?:\r\n|\n|\r)+$/g, "");
}

export function wrapNoteContent(markdown, eol = "\n") {
  const content = String(markdown ?? "");
  const longestRun = Math.max(0, ...[...content.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(Math.max(4, longestRun + 1));
  return `${fence}tracker-notes${eol}${content}${content && !content.endsWith("\n") && !content.endsWith("\r") ? eol : ""}${fence}`;
}

export function unwrapNoteContent(raw) {
  const source = trimBoundaryNewlines(raw);
  const lines = source.split(/\r\n|\n|\r/);
  const opening = /^(`{4,})tracker-notes[ \t]*$/.exec(lines[0] || "");
  if (!opening) {
    const malformed = /^`+tracker-notes(?:[ \t].*)?$/.test(lines[0] || "");
    return { content: source, wrapped: false, malformed };
  }

  const closing = /^(`+)[ \t]*$/.exec(lines.at(-1) || "");
  if (!closing || closing[1].length < opening[1].length) {
    return { content: source, wrapped: false, malformed: true };
  }

  return {
    content: lines.slice(1, -1).join("\n"),
    wrapped: true,
    malformed: false
  };
}

export function splitTerminalNotes(body) {
  const heading = /^##[ \t]+Notes[ \t]*$/im.exec(body);
  if (!heading) {
    return { documentBody: body, notesRaw: "", hasNotes: false, wrapped: false, malformed: false };
  }

  const raw = body.slice(heading.index + heading[0].length);
  const notes = unwrapNoteContent(raw);
  return {
    documentBody: body.slice(0, heading.index),
    notesRaw: notes.content,
    hasNotes: true,
    wrapped: notes.wrapped,
    malformed: notes.malformed
  };
}
