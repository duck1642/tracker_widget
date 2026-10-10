import type { TodoItem } from "./types.ts";
export function createTodoItem(indent: number = 0): TodoItem {
  const newId = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  return {
    id: newId,
    isTodo: true,
    checked: false,
    text: "",
    indent
  };
}
