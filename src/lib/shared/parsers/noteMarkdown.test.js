import { describe, expect, it } from "vitest";
import {
  noteBlockAtOffset,
  parseNoteMarkdown,
  replaceNoteBlock,
  toggleNoteCheckbox
} from "./noteMarkdown.js";

describe("note Markdown blocks", () => {
  it("keeps exact ranges for the supported line types", () => {
    const markdown = "# Title\n- [ ] Task\n1. Ordered\n> Quote\n---\nText";
    const blocks = parseNoteMarkdown(markdown);

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "checkbox",
      "ordered",
      "blockquote",
      "hr",
      "paragraph"
    ]);
    expect(blocks[1]).toMatchObject({
      raw: "- [ ] Task",
      content: "Task",
      start: 8,
      end: 18
    });
    expect(blocks[2]).toMatchObject({ marker: "1.", content: "Ordered" });
    expect(noteBlockAtOffset(blocks, 19)).toBe(blocks[2]);
  });

  it("treats a multiline fence as one block and respects delimiter length", () => {
    const markdown = "Before\n`````js\n```inner```\n````\nstill code\n`````\nAfter";
    const blocks = parseNoteMarkdown(markdown);

    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toMatchObject({
      type: "codeblock",
      language: "js",
      fenceLength: 5,
      closed: true,
      content: "```inner```\n````\nstill code"
    });
    expect(blocks[1].raw).toBe("`````js\n```inner```\n````\nstill code\n`````");
  });

  it("preserves an unclosed fence through the end of the note", () => {
    const blocks = parseNoteMarkdown("Text\n````python\nprint('x')\n```");

    expect(blocks[1]).toMatchObject({
      type: "codeblock",
      language: "python",
      fenceLength: 4,
      closed: false,
      content: "print('x')\n```"
    });
  });

  it("replaces only the active raw range and toggles checkboxes", () => {
    const markdown = "Before\n- [ ] Task\nAfter";
    const blocks = parseNoteMarkdown(markdown);

    expect(replaceNoteBlock(markdown, blocks[1], "- [ ] Updated")).toBe("Before\n- [ ] Updated\nAfter");
    expect(toggleNoteCheckbox(markdown, blocks[1])).toBe("Before\n- [x] Task\nAfter");
  });
});
