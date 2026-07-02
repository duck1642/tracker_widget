/**
 * @param {any[]} todos
 * @param {any} action
 * @param {boolean} isInverse
 */
export function applyAction(todos, action, isInverse) {
  let updatedTodos = [...todos];
  if (action.type === "delete") {
    if (isInverse) {
      updatedTodos.splice(action.index, 0, action.todo);
    } else {
      const idx = updatedTodos.findIndex(t => t.id === action.todo.id);
      if (idx !== -1) updatedTodos.splice(idx, 1);
    }
  } else if (action.type === "add") {
    if (isInverse) {
      const idx = updatedTodos.findIndex(t => t.id === action.todo.id);
      if (idx !== -1) updatedTodos.splice(idx, 1);
    } else {
      updatedTodos.splice(action.index, 0, action.todo);
    }
  } else if (action.type === "toggle") {
    const todo = updatedTodos.find(t => t.id === action.id);
    if (todo) {
      todo.checked = isInverse ? action.oldChecked : action.newChecked;
    }
  } else if (action.type === "edit") {
    const todo = updatedTodos.find(t => t.id === action.id);
    if (todo) {
      todo.text = isInverse ? action.oldText : action.newText;
    }
  } else if (action.type === "move") {
    const from = isInverse ? action.toIndex : action.fromIndex;
    const to = isInverse ? action.fromIndex : action.toIndex;
    if (from >= 0 && from < updatedTodos.length && to >= 0 && to < updatedTodos.length) {
      const temp = updatedTodos[from];
      updatedTodos[from] = updatedTodos[to];
      updatedTodos[to] = temp;
    }
  } else if (action.type === "indent") {
    const todo = updatedTodos.find(t => t.id === action.id);
    if (todo) {
      todo.indent = isInverse ? action.oldIndent : action.newIndent;
    }
  } else if (action.type === "clear_completed") {
    if (isInverse) {
      // Restore in ascending order of original index
      const sorted = [...action.deletedTodos].sort((a, b) => a.index - b.index);
      for (const entry of sorted) {
        updatedTodos.splice(entry.index, 0, entry.todo);
      }
    } else {
      const idsToDelete = new Set(action.deletedTodos.map((/** @type {any} */ x) => x.todo.id));
      updatedTodos = updatedTodos.filter(t => !idsToDelete.has(t.id));
    }
  }
  return updatedTodos;
}
