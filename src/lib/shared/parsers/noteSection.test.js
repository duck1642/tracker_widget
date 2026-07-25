import { describe, expect, it } from "vitest";
import { splitTerminalNotes, unwrapNoteContent, wrapNoteContent } from "./noteSection.js";

describe("tracker notes format", () => {
  it("wraps standalone Markdown with a fence longer than its longest backtick run", () => {
    expect(wrapNoteContent("# Heading\n\n```js\ncode();\n```")).toBe(
      "````tracker-notes\n# Heading\n\n```js\ncode();\n```\n````"
    );
    expect(wrapNoteContent("# Heading\n\n````\nwide fence\n````")).toBe(
      "`````tracker-notes\n# Heading\n\n````\nwide fence\n````\n`````"
    );
  });

  it("unwraps valid tracker notes and preserves malformed wrappers as legacy text", () => {
    expect(unwrapNoteContent("````tracker-notes\n# Heading\n## Child\n````")).toEqual({
      content: "# Heading\n## Child",
      wrapped: true,
      malformed: false
    });

    const malformed = "````tracker-notes\n# Heading";
    expect(unwrapNoteContent(malformed)).toEqual({
      content: malformed,
      wrapped: false,
      malformed: true
    });
  });

  it("treats the first Notes heading as a terminal section before parsing document headings", () => {
    const body = "# Document\n\n## Work\n\nContent\n\n## Notes\n\n# Note title\n\n## Note subsection\n\nText";
    expect(splitTerminalNotes(body)).toMatchObject({
      documentBody: "# Document\n\n## Work\n\nContent\n\n",
      notesRaw: "# Note title\n\n## Note subsection\n\nText",
      hasNotes: true,
      wrapped: false
    });
  });
});
