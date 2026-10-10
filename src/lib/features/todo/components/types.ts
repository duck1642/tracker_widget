import type { TodoItem } from "../types.ts";

export interface TodoRowCallbacks {
  inputElements: Record<string, HTMLTextAreaElement>;
  onToggleTodo(id: string): unknown;
  onToggleFold(id: string): unknown;
  onUpdateText(id: string, text: string): unknown;
  onMoveTodoToVisiblePosition(index: number, position: number): Promise<boolean>;
  onFocus(id: string, text: string): void;
  onBlur(id: string, text: string): void;
  onKeyDown(event: KeyboardEvent, index: number, todo: TodoItem): unknown;
  onSelectTodo(event: MouseEvent, id: string): void;
  onSetSelectionAnchor(id: string): void;
  onClearSelection(): void;
  onOpenContextMenu(event: MouseEvent, id: string): void;
}
