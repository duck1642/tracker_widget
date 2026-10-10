export interface TodoItem {
  id: string; isTodo: true; checked: boolean; text: string; indent: number;
}
export interface RawLine {
    id: string;
    isTodo: false;
    raw: string;
}
export type TodoLine = TodoItem | RawLine;
export interface CheckedChange {
    id: string;
    oldChecked: boolean;
    newChecked: boolean;
}
export interface IndentChange {
    id: string;
    oldIndent: number;
    newIndent: number;
}
export type TodoAction =
  | {
      type: "add" | "delete";
      index: number;
      todo: TodoLine;
  }
  | ({ type: "toggle" } & CheckedChange)
  | { type: "set_checked_many"; todos: CheckedChange[] }
  | {
      type: "edit";
      id: string;
      oldText: string;
      newText: string;
  }
  | {
      type: "move" | "move_to";
      fromIndex: number;
      toIndex: number;
  }
  | ({ type: "indent" } & IndentChange)
  | { type: "shift_indent_many"; todos: IndentChange[] }
  | { type: "delete_many" | "clear_completed"; deletedTodos: { index: number; todo: TodoLine }[] };
