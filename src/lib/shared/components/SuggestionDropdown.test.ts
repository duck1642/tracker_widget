// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SuggestionDropdown from "./SuggestionDropdown.svelte";

describe("SuggestionDropdown", () => {
  it("renders accessible options and preserves focus during pointer selection", async () => {
    const onSelect = vi.fn();
    const onHighlight = vi.fn();
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();

    render(SuggestionDropdown, {
      suggestions: [{ name: "Deep Work", plannedThisWeek: true }, { name: "Review", plannedThisWeek: false }],
      highlightedIndex: 0,
      onSelect,
      onHighlight,
      ariaLabel: "Session suggestions",
      width: "bounded",
      showPlannedMarkers: true
    });

    const listbox = screen.getByRole("listbox", { name: "Session suggestions" });
    expect(listbox.classList.contains("bounded")).toBe(true);
    expect(screen.getByRole("option", { name: "Deep Work" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTitle("Planned this week").textContent).toBe("*");

    const review = screen.getByRole("option", { name: "Review" });
    await fireEvent.mouseEnter(review);
    expect(onHighlight).toHaveBeenCalledWith(1);

    const pointerDown = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    review.dispatchEvent(pointerDown);
    expect(pointerDown.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);

    await fireEvent.click(review);
    expect(onSelect).toHaveBeenCalledWith({ name: "Review", plannedThisWeek: false });
  });
});
