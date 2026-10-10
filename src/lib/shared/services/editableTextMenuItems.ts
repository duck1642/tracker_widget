import { ClipboardPaste, Copy, Scissors, TextSelect } from "@lucide/svelte";
import {
  copyEditableSelection,
  cutEditableSelection,
  editableTextValue,
  hasEditableSelection,
  pasteIntoEditable,
  selectAllEditableText
} from "./editableTextClipboard.ts";

export type EditableTextContext = import("./editableTextClipboard.ts").EditableTextContext;
export type EditableTextMenuItem = import("../components/types.ts").MenuItem;

/**
 * Builds the standard editable text actions used by app context menus.
 */
export function buildEditableTextMenuItems(context: EditableTextContext | null | undefined, {
  beforeAction = () => {},
  onError = () => {},
  includeSelectAll = true,
  trailingSeparator = true
}: {
  beforeAction?: () => void,
  onError?: (error: unknown) => void,
  includeSelectAll?: boolean,
  trailingSeparator?: boolean
} = {}): EditableTextMenuItem[] {
  if (!context) return [];


  const run = (action: (editable: EditableTextContext) => unknown | Promise<unknown>) => async () => {
    beforeAction();
    try {
      await action(context);
    } catch (error) {
      onError(error);
    }
  };


  const items: EditableTextMenuItem[] = [
    { label: "Cut", icon: Scissors, disabled: !hasEditableSelection(context), onclick: run(cutEditableSelection) },
    { label: "Copy", icon: Copy, disabled: !hasEditableSelection(context), onclick: run(copyEditableSelection) },
    { label: "Paste", icon: ClipboardPaste, onclick: run(pasteIntoEditable) }
  ];
  if (includeSelectAll) {
    items.push({
      label: "Select All",
      icon: TextSelect,
      disabled: !editableTextValue(context),
      onclick: run(selectAllEditableText)
    });
  }
  if (trailingSeparator) items.push({ separator: true });
  return items;
}
