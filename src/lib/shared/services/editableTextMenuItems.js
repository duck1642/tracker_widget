import { ClipboardPaste, Copy, Scissors, TextSelect } from "@lucide/svelte";
import {
  copyEditableSelection,
  cutEditableSelection,
  hasEditableSelection,
  pasteIntoEditable,
  selectAllEditableText
} from "./editableTextClipboard.js";

/** @typedef {{ target: HTMLInputElement | HTMLTextAreaElement, selectionStart: number, selectionEnd: number, selectedText: string }} EditableTextContext */
/** @typedef {{ label?: string, icon?: any, disabled?: boolean, onclick?: () => Promise<void>, separator?: boolean }} EditableTextMenuItem */

/**
 * Builds the standard editable text actions used by app context menus.
 *
 * @param {EditableTextContext | null | undefined} context
 * @param {{
 *   beforeAction?: () => void,
 *   onError?: (error: unknown) => void,
 *   includeSelectAll?: boolean,
 *   trailingSeparator?: boolean
 * }} options
 * @returns {EditableTextMenuItem[]}
 */
export function buildEditableTextMenuItems(context, {
  beforeAction = () => {},
  onError = () => {},
  includeSelectAll = true,
  trailingSeparator = true
} = {}) {
  if (!context) return [];

  /** @param {(editable: EditableTextContext) => unknown | Promise<unknown>} action */
  const run = (action) => async () => {
    beforeAction();
    try {
      await action(context);
    } catch (error) {
      onError(error);
    }
  };

  /** @type {EditableTextMenuItem[]} */
  const items = [
    { label: "Cut", icon: Scissors, disabled: !hasEditableSelection(context), onclick: run(cutEditableSelection) },
    { label: "Copy", icon: Copy, disabled: !hasEditableSelection(context), onclick: run(copyEditableSelection) },
    { label: "Paste", icon: ClipboardPaste, onclick: run(pasteIntoEditable) }
  ];
  if (includeSelectAll) {
    items.push({
      label: "Select All",
      icon: TextSelect,
      disabled: !context.target.value,
      onclick: run(selectAllEditableText)
    });
  }
  if (trailingSeparator) items.push({ separator: true });
  return items;
}
