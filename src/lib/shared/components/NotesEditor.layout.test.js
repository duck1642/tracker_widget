// @vitest-environment jsdom
// @ts-nocheck
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import NotesEditor from "./NotesEditor.svelte";

afterEach(cleanup);

describe("NotesEditor layout", () => {
  it("opts into a full-height editor without changing the default layout", () => {
    const full = render(NotesEditor, {
      value: "",
      label: "Scratchpad",
      fillHeight: true,
      onChange: vi.fn()
    });
    expect(screen.getByLabelText("Scratchpad").closest(".notes-container")?.classList.contains("fill-height")).toBe(true);

    full.unmount();
    render(NotesEditor, {
      value: "",
      label: "Daily notes",
      onChange: vi.fn()
    });
    expect(screen.getByLabelText("Daily notes").closest(".notes-container")?.classList.contains("fill-height")).toBe(false);
  });
});
