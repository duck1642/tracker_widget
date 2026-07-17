// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { suppressPrintShortcut } from "./applicationShortcuts.js";

afterEach(() => {
  document.body.replaceChildren();
});

describe("application shortcuts", () => {
  it.each([
    { ctrlKey: true, metaKey: false },
    { ctrlKey: false, metaKey: true }
  ])("suppresses the platform print shortcut", ({ ctrlKey, metaKey }) => {
    const event = new KeyboardEvent("keydown", { key: "p", ctrlKey, metaKey, bubbles: true, cancelable: true });

    expect(suppressPrintShortcut(event)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("suppresses printing while an editor is focused", () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    window.addEventListener("keydown", suppressPrintShortcut, { once: true });
    const event = new KeyboardEvent("keydown", { key: "P", ctrlKey: true, bubbles: true, cancelable: true });

    input.dispatchEvent(event);

    expect(document.activeElement).toBe(input);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves unrelated and modified shortcuts alone", () => {
    for (const event of [
      new KeyboardEvent("keydown", { key: "p", bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "p", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "PageDown", ctrlKey: true, bubbles: true, cancelable: true })
    ]) {
      expect(suppressPrintShortcut(event)).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    }
  });
});
