import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

const editableInputTypes = new Set(["email", "password", "search", "tel", "text", "url"]);

export type EditableTextContext = {
  target?: HTMLInputElement | HTMLTextAreaElement,
  value?: string,
  selectionStart: number,
  selectionEnd: number,
  selectedText: string,
  focus?: () => void,
  setSelectionRange?: (start: number, end: number) => void,
  replaceSelection?: (text: string, inputType: string) => void
};


export function captureEditableText(target: EventTarget | null): EditableTextContext | null {
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


export function hasEditableSelection(context: EditableTextContext | null | undefined) {
  return Boolean(context?.selectedText);
}


export function editableTextValue(context: EditableTextContext | null | undefined) {
  return context?.value ?? context?.target?.value ?? "";
}


export async function copyEditableSelection(context: EditableTextContext) {
  if (!hasEditableSelection(context)) return false;
  await writeText(context.selectedText);
  restoreSelection(context);
  return true;
}


export async function cutEditableSelection(context: EditableTextContext) {
  if (!hasEditableSelection(context)) return false;
  await writeText(context.selectedText);
  replaceEditableSelection(context, "", "deleteByCut");
  return true;
}


export async function pasteIntoEditable(context: EditableTextContext | null | undefined) {
  if (!context) return false;
  const text = await readText();
  replaceEditableSelection(context, text, "insertFromPaste");
  return true;
}


export function selectAllEditableText(context: EditableTextContext | null | undefined) {
  if (!context) return false;
  focusEditable(context);
  setEditableSelection(context, 0, editableTextValue(context).length);
  return true;
}


function restoreSelection(context: EditableTextContext) {
  focusEditable(context);
  setEditableSelection(context, context.selectionStart, context.selectionEnd);
}


function focusEditable(context: EditableTextContext) {
  if (context.focus) context.focus();
  else context.target?.focus();
}


function setEditableSelection(context: EditableTextContext, start: number, end: number) {
  if (context.setSelectionRange) context.setSelectionRange(start, end);
  else context.target?.setSelectionRange(start, end);
}


function replaceEditableSelection(context: EditableTextContext, text: string, inputType: string) {
  const { target, selectionStart, selectionEnd } = context;
  restoreSelection(context);

  if (context.replaceSelection) {
    context.replaceSelection(text, inputType);
    return;
  }
  if (!target) return;

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
