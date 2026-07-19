import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

const editableInputTypes = new Set(["email", "password", "search", "tel", "text", "url"]);

/** @typedef {{ target: HTMLInputElement | HTMLTextAreaElement, selectionStart: number, selectionEnd: number, selectedText: string }} EditableTextContext */

/** @param {EventTarget | null} target @returns {EditableTextContext | null} */
export function captureEditableText(target) {
  const isTextarea = target instanceof HTMLTextAreaElement;
  const isTextInput = target instanceof HTMLInputElement && editableInputTypes.has(target.type);
  if ((!isTextarea && !isTextInput) || target.disabled || target.readOnly) return null;

  const selectionStart = target.selectionStart;
  const selectionEnd = target.selectionEnd;
  if (selectionStart === null || selectionEnd === null) return null;

  return {
    target,
    selectionStart,
    selectionEnd,
    selectedText: target.value.slice(selectionStart, selectionEnd)
  };
}

/** @param {EditableTextContext | null | undefined} context */
export function hasEditableSelection(context) {
  return Boolean(context?.selectedText);
}

/** @param {EditableTextContext} context */
export async function copyEditableSelection(context) {
  if (!hasEditableSelection(context)) return false;
  await writeText(context.selectedText);
  restoreSelection(context);
  return true;
}

/** @param {EditableTextContext} context */
export async function cutEditableSelection(context) {
  if (!hasEditableSelection(context)) return false;
  await writeText(context.selectedText);
  replaceEditableSelection(context, "", "deleteByCut");
  return true;
}

/** @param {EditableTextContext | null | undefined} context */
export async function pasteIntoEditable(context) {
  if (!context) return false;
  const text = await readText();
  replaceEditableSelection(context, text, "insertFromPaste");
  return true;
}

/** @param {EditableTextContext} context */
function restoreSelection(context) {
  context.target.focus();
  context.target.setSelectionRange(context.selectionStart, context.selectionEnd);
}

/** @param {EditableTextContext} context @param {string} text @param {string} inputType */
function replaceEditableSelection(context, text, inputType) {
  const { target, selectionStart, selectionEnd } = context;
  restoreSelection(context);

  const previousValue = target.value;
  let inputDispatched = false;
  const markInput = () => { inputDispatched = true; };
  target.addEventListener("input", markInput, { once: true });

  let appliedNatively = false;
  try {
    appliedNatively = document.queryCommandSupported?.("insertText") === true
      && document.execCommand("insertText", false, text) === true;
  } catch {
    appliedNatively = false;
  }

  target.removeEventListener("input", markInput);
  if (!appliedNatively || target.value === previousValue) {
    target.setRangeText(text, selectionStart, selectionEnd, "end");
  }
  if (!inputDispatched) {
    target.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType,
      data: text || null
    }));
  }
}
