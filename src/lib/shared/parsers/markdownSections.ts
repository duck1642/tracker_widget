export function splitFrontmatter(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const match = normalized.match(/^(---\n[\s\S]*?\n---)\n?/);
  return match
    ? { frontmatterRaw: match[1], body: normalized.slice(match[0].length) }
    : { frontmatterRaw: "", body: normalized };
}

export function escapeTableCell(value: unknown) {
  return String(value).replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

export function splitTableRow(line: string) {
  const value = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let current = "";
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function createId(prefix: string, index: number) {
  return `${prefix}-${index}`;
}
