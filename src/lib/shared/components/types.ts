import type { Component } from "svelte";
import type { EditableTextContext } from "../services/editableTextClipboard.ts";
export type MenuItem =
  | {
      separator: true;
      label?: never;
      icon?: never;
      disabled?: never;
      onclick?: never;
      checked?: never;
  }
  | {
      separator?: false;
      label: string;
      icon?: Component<{
          size?: number;
          open?: boolean;
      }>;
      iconProps?: {
          open?: boolean;
      };
      isHeader?: boolean;
      disabled?: boolean;
      checked?: boolean;
      danger?: boolean;
      onclick?: () => unknown | Promise<unknown>;
  };
export interface MenuPosition {
    x: number;
    y: number;
    editable?: EditableTextContext | null;
}
export type InputKeyboardEvent = KeyboardEvent & { currentTarget: HTMLInputElement };
