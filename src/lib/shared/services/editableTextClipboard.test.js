// @vitest-environment jsdom
// @ts-nocheck
import { afterEach, describe, expect, it, vi } from "vitest";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { captureEditableText, copyEditableSelection, cutEditableSelection, pasteIntoEditable, selectAllEditableText } from "./editableTextClipboard.js";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: vi.fn(),
  writeText: vi.fn()
}));

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  delete document.queryCommandSupported;
  delete document.execCommand;
});

function editable(value = "Alpha Beta") {
  const input = document.createElement("input");
  input.value = value;
  document.body.append(input);
  input.focus();
  return input;
}

describe("editable text clipboard", () => {
  it("captures only writable text controls and their selection", () => {
    const input = editable();
    input.setSelectionRange(0, 5);
    expect(captureEditableText(input)).toMatchObject({ selectionStart: 0, selectionEnd: 5, selectedText: "Alpha" });

    input.readOnly = true;
    expect(captureEditableText(input)).toBeNull();
    expect(captureEditableText(document.createElement("button"))).toBeNull();
  });

  it("copies and cuts selected text through the system clipboard", async () => {
    const input = editable();
    input.setSelectionRange(0, 5);
    const context = captureEditableText(input);
    const inputEvents = [];
    input.addEventListener("input", (event) => inputEvents.push(event));

    await copyEditableSelection(context);
    expect(writeText).toHaveBeenLastCalledWith("Alpha");
    expect(input.value).toBe("Alpha Beta");

    await cutEditableSelection(context);
    expect(writeText).toHaveBeenLastCalledWith("Alpha");
    expect(input.value).toBe(" Beta");
    expect(input.selectionStart).toBe(0);
    expect(inputEvents).toHaveLength(1);
    expect(inputEvents[0].inputType).toBe("deleteByCut");
  });

  it("pastes at the captured range and emits an input event", async () => {
    readText.mockResolvedValue("Gamma");
    const input = editable();
    input.setSelectionRange(6, 10);
    const context = captureEditableText(input);
    const onInput = vi.fn();
    input.addEventListener("input", onInput);

    await pasteIntoEditable(context);
    expect(readText).toHaveBeenCalledOnce();
    expect(input.value).toBe("Alpha Gamma");
    expect(input.selectionStart).toBe(11);
    expect(onInput).toHaveBeenCalledOnce();
    expect(onInput.mock.calls[0][0].inputType).toBe("insertFromPaste");
  });

  it("uses native insertion when supported without duplicating input events", async () => {
    readText.mockResolvedValue("Gamma");
    const input = editable();
    input.setSelectionRange(6, 10);
    const onInput = vi.fn();
    input.addEventListener("input", onInput);
    document.queryCommandSupported = vi.fn(() => true);
    document.execCommand = vi.fn((_command, _ui, text) => {
      input.setRangeText(text, input.selectionStart, input.selectionEnd, "end");
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      return true;
    });

    await pasteIntoEditable(captureEditableText(input));
    expect(document.execCommand).toHaveBeenCalledWith("insertText", false, "Gamma");
    expect(input.value).toBe("Alpha Gamma");
    expect(onInput).toHaveBeenCalledOnce();
  });

  it("does not delete text when writing the clipboard fails", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const input = editable();
    input.setSelectionRange(0, 5);

    await expect(cutEditableSelection(captureEditableText(input))).rejects.toThrow("denied");
    expect(input.value).toBe("Alpha Beta");
  });

  it("selects all text in only the captured editor", () => {
    const input = editable();
    input.setSelectionRange(3, 3);
    const other = editable("Other");
    other.setSelectionRange(2, 2);

    expect(selectAllEditableText(captureEditableText(input))).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(other.selectionStart).toBe(2);
    expect(other.selectionEnd).toBe(2);
  });
});
