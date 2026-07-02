// @ts-nocheck
function sameIds(left, right) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function getFoldableTodoIds(todos) {
  const ids = new Set();
  for (let index = 0; index < todos.length; index += 1) {
    const todo = todos[index];
    if (!todo?.isTodo) continue;
    for (let nextIndex = index + 1; nextIndex < todos.length; nextIndex += 1) {
      const next = todos[nextIndex];
      if (!next?.isTodo) continue;
      if (next.indent <= todo.indent) break;
      ids.add(todo.id);
      break;
    }
  }
  return ids;
}

export function buildVisibleTodoRows(todos, foldedTodoIds) {
  const foldableIds = getFoldableTodoIds(todos);
  const foldedIds = new Set(foldedTodoIds.filter((id) => foldableIds.has(id)));
  const foldedAncestorIndents = [];
  const rows = [];

  for (let index = 0; index < todos.length; index += 1) {
    const todo = todos[index];
    if (!todo?.isTodo) {
      rows.push({ todo, storeIndex: index, hasChildren: false, isFolded: false });
      continue;
    }

    while (foldedAncestorIndents.length && todo.indent <= foldedAncestorIndents[foldedAncestorIndents.length - 1]) {
      foldedAncestorIndents.pop();
    }

    const hasChildren = foldableIds.has(todo.id);
    const isFolded = foldedIds.has(todo.id);
    const isHidden = foldedAncestorIndents.length > 0;

    if (!isHidden) {
      rows.push({ todo, storeIndex: index, hasChildren, isFolded });
    }
    if (isFolded) {
      foldedAncestorIndents.push(todo.indent);
    }
  }

  return { rows, foldableIds: [...foldableIds], foldedIds: [...foldedIds] };
}

class TodoFoldStore {
  foldedTodoIds = $state([]);
  foldableTodoIds = $state([]);

  setFoldableTodoIds(ids) {
    const nextFoldableIds = [...ids];
    const foldable = new Set(nextFoldableIds);
    const nextFoldedIds = this.foldedTodoIds.filter((id) => foldable.has(id));
    if (!sameIds(this.foldableTodoIds, nextFoldableIds)) {
      this.foldableTodoIds = nextFoldableIds;
    }
    if (!sameIds(this.foldedTodoIds, nextFoldedIds)) {
      this.foldedTodoIds = nextFoldedIds;
    }
  }

  toggleTodo(id) {
    this.foldedTodoIds = this.foldedTodoIds.includes(id)
      ? this.foldedTodoIds.filter((item) => item !== id)
      : [...this.foldedTodoIds, id];
  }

  collapseAll() {
    this.foldedTodoIds = [...this.foldableTodoIds];
  }

  expandAll() {
    this.foldedTodoIds = [];
  }

  get hasFoldableTodos() {
    return this.foldableTodoIds.length > 0;
  }

  get hasCollapsedTodos() {
    const foldable = new Set(this.foldableTodoIds);
    return this.foldedTodoIds.some((id) => foldable.has(id));
  }
}

export const todoFoldStore = new TodoFoldStore();
