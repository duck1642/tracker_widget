/**
 * @param {any[]} tasks
 * @param {any} action
 * @param {boolean} isInverse
 */
export function applyAction(tasks, action, isInverse) {
  let updatedTasks = [...tasks];
  if (action.type === "delete") {
    if (isInverse) {
      updatedTasks.splice(action.index, 0, action.task);
    } else {
      const idx = updatedTasks.findIndex(t => t.id === action.task.id);
      if (idx !== -1) updatedTasks.splice(idx, 1);
    }
  } else if (action.type === "add") {
    if (isInverse) {
      const idx = updatedTasks.findIndex(t => t.id === action.task.id);
      if (idx !== -1) updatedTasks.splice(idx, 1);
    } else {
      updatedTasks.splice(action.index, 0, action.task);
    }
  } else if (action.type === "toggle") {
    const task = updatedTasks.find(t => t.id === action.id);
    if (task) {
      task.checked = isInverse ? action.oldChecked : action.newChecked;
    }
  } else if (action.type === "edit") {
    const task = updatedTasks.find(t => t.id === action.id);
    if (task) {
      task.text = isInverse ? action.oldText : action.newText;
    }
  } else if (action.type === "move") {
    const from = isInverse ? action.toIndex : action.fromIndex;
    const to = isInverse ? action.fromIndex : action.toIndex;
    if (from >= 0 && from < updatedTasks.length && to >= 0 && to < updatedTasks.length) {
      const temp = updatedTasks[from];
      updatedTasks[from] = updatedTasks[to];
      updatedTasks[to] = temp;
    }
  } else if (action.type === "indent") {
    const task = updatedTasks.find(t => t.id === action.id);
    if (task) {
      task.indent = isInverse ? action.oldIndent : action.newIndent;
    }
  } else if (action.type === "clear_completed") {
    if (isInverse) {
      // Restore in ascending order of original index
      const sorted = [...action.deletedTasks].sort((a, b) => a.index - b.index);
      for (const entry of sorted) {
        updatedTasks.splice(entry.index, 0, entry.task);
      }
    } else {
      const idsToDelete = new Set(action.deletedTasks.map((/** @type {any} */ x) => x.task.id));
      updatedTasks = updatedTasks.filter(t => !idsToDelete.has(t.id));
    }
  }
  return updatedTasks;
}
