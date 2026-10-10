import type { TodoItem, TodoLine } from "$lib/features/todo/types.ts";

export function requireTodo(line: TodoLine): TodoItem {
  if (!line.isTodo) throw new Error("Expected a checklist row");
  return line;
}
