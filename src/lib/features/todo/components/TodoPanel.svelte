<script>
  import { tick } from "svelte";
  import { todoStore } from "$lib/features/todo/todoStore.svelte.js";
  import { buildVisibleTodoRows, todoFoldStore } from "$lib/features/todo/todoFolding.svelte.js";
  import { todoUiState } from "$lib/features/todo/todoUiState.svelte.js";
  import { workspaceStore } from "$lib/app/workspaceStore.svelte.js";
  import TodoList from "./TodoList.svelte";
  import TodoContextMenu from "./TodoContextMenu.svelte";

  let focusedTodoId = $state("");
  /** @type {{ x: number, y: number } | null} */
  let contextMenu = $state(null);
  /** @type {Record<string, string>} */
  let originalTexts = {};

  // Keep a reference to inputs to set focus programmatically
  /** @type {Record<string, HTMLInputElement>} */
  let inputElements = {};
  let visibleTodos = $derived(buildVisibleTodoRows(todoStore.todos, todoFoldStore.foldedTodoIds));
  let visibleTodoRows = $derived(visibleTodos.rows.filter((row) => row.todo.isTodo));
  let visibleTodoIds = $derived(visibleTodoRows.map((row) => row.todo.id));

  $effect(() => {
    todoFoldStore.setFoldableTodoIds(visibleTodos.foldableIds);
  });

  $effect(() => {
    todoUiState.pruneSelection(todoStore.todos.filter((todo) => todo.isTodo).map((todo) => todo.id));
  });

  $effect(() => {
    if (!todoUiState.hasSelection) closeContextMenu();
  });

  /** @param {number} index */
  function isVisibleStoreIndex(index) {
    return visibleTodos.rows.some((row) => row.storeIndex === index);
  }

  /** @param {number} index */
  function visiblePositionForStoreIndex(index) {
    return visibleTodoRows.findIndex((row) => row.storeIndex === index) + 1;
  }

  /**
   * @param {number} fromIndex
   * @param {number} targetPosition
   */
  function canMoveTodoToVisiblePosition(fromIndex, targetPosition) {
    const sourcePosition = visiblePositionForStoreIndex(fromIndex);
    return Number.isInteger(targetPosition)
      && sourcePosition >= 1
      && targetPosition >= 1
      && targetPosition <= visibleTodoRows.length
      && targetPosition !== sourcePosition;
  }

  /**
   * @param {number} fromIndex
   * @param {number} targetPosition
   */
  async function moveTodoToVisiblePosition(fromIndex, targetPosition) {
    if (!canMoveTodoToVisiblePosition(fromIndex, targetPosition)) return false;
    const targetIndex = visibleTodoRows[targetPosition - 1]?.storeIndex;
    const todoId = todoStore.todos[fromIndex]?.id;
    if (typeof targetIndex !== "number" || !todoStore.moveTodoTo(fromIndex, targetIndex)) return false;
    await tick();
    focusedTodoId = todoId;
    inputElements[todoId]?.focus();
    return true;
  }

  /**
   * @param {MouseEvent} event
   * @param {string} id
   */
  function handleSelectTodo(event, id) {
    if (event.shiftKey) {
      todoUiState.selectRange(visibleTodoIds, id);
    } else {
      todoUiState.toggleSelection(id);
    }
  }

  /** @param {string} id */
  function setSelectionAnchor(id) {
    todoUiState.setAnchor(id);
  }

  function clearSelection() {
    todoUiState.clearSelection();
    closeContextMenu();
  }

  /** @param {string} id */
  function toggleFold(id) {
    clearSelection();
    todoFoldStore.toggleTodo(id);
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  /**
   * @param {MouseEvent} event
   * @param {string} id
   */
  function openContextMenu(event, id) {
    event.preventDefault();
    if (!todoUiState.isSelected(id)) {
      todoUiState.setSelection([id], id);
    }
    contextMenu = { x: event.clientX, y: event.clientY };
  }

  function handleClearSelectionFromMenu() {
    clearSelection();
  }

  /** @param {boolean} checked */
  function handleSetSelectedChecked(checked) {
    todoStore.setTodosCheckedByIds(todoUiState.selectedTodoIds, checked);
    closeContextMenu();
  }

  /** @param {number} delta */
  function handleShiftSelectedIndent(delta) {
    todoStore.shiftTodosIndentByIds(todoUiState.selectedTodoIds, delta);
    closeContextMenu();
  }

  function handleDeleteSelected() {
    if (todoStore.deleteTodosByIds(todoUiState.selectedTodoIds)) {
      clearSelection();
    } else {
      closeContextMenu();
    }
  }

  /** @param {MouseEvent} event */
  function handleRawContextMenu(event) {
    event.preventDefault();
    clearSelection();
  }

  /** @param {MouseEvent} event */
  function handleBlankContextMenu(event) {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    clearSelection();
  }

  // Todo keyboard navigation and editing handlers
  /**
   * @param {KeyboardEvent} event
   * @param {number} index
   * @param {any} todo
   */
  async function handleKeyDown(event, index, todo) {
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      const sourcePosition = visiblePositionForStoreIndex(index);
      const targetPosition = event.key === "ArrowUp" ? sourcePosition - 1 : sourcePosition + 1;
      if (canMoveTodoToVisiblePosition(index, targetPosition)) {
        event.preventDefault();
        await moveTodoToVisiblePosition(index, targetPosition);
      }
    } else if (event.key === "Backspace" && todo.text === "") {
      event.preventDefault();
      let nextFocusId = "";
      for (let i = index - 1; i >= 0; i--) {
        if (todoStore.todos[i].isTodo && isVisibleStoreIndex(i)) {
          nextFocusId = todoStore.todos[i].id;
          break;
        }
      }
      if (!nextFocusId) {
        for (let i = index + 1; i < todoStore.todos.length; i++) {
          if (todoStore.todos[i].isTodo && isVisibleStoreIndex(i)) {
            nextFocusId = todoStore.todos[i].id;
            break;
          }
        }
      }
      delete originalTexts[todo.id];
      todoStore.deleteTodo(index);
      await tick();
      focusedTodoId = nextFocusId;
      inputElements[nextFocusId]?.focus();
    } else if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        todoStore.outdentTodo(todo.id);
      } else {
        todoStore.indentTodo(todo.id);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      const newId = todoStore.addTodo(index, todo.indent);
      focusedTodoId = newId;
      
      // Focus the newly inserted todo input.
      await tick();
      if (inputElements[newId]) {
        inputElements[newId].focus();
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      for (let i = index - 1; i >= 0; i--) {
        if (todoStore.todos[i].isTodo && isVisibleStoreIndex(i)) {
          focusedTodoId = todoStore.todos[i].id;
          if (inputElements[todoStore.todos[i].id]) {
            inputElements[todoStore.todos[i].id].focus();
          }
          break;
        }
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      for (let i = index + 1; i < todoStore.todos.length; i++) {
        if (todoStore.todos[i].isTodo && isVisibleStoreIndex(i)) {
          focusedTodoId = todoStore.todos[i].id;
          if (inputElements[todoStore.todos[i].id]) {
            inputElements[todoStore.todos[i].id].focus();
          }
          break;
        }
      }
    } else if (event.key === "Escape") {
      if (contextMenu) {
        event.preventDefault();
        closeContextMenu();
        return;
      }
      if (todoUiState.hasSelection) {
        event.preventDefault();
        todoUiState.clearSelection();
        return;
      }
      if (event.target instanceof HTMLElement) {
        event.target.blur();
      }
    }
  }
</script>

{#if todoStore.fileMissing}
  <div class="empty">
    <strong>No todo.md found</strong>
    {#if workspaceStore.workspaceAvailable}
      <span>Create a workspace todo file or import an existing Markdown file.</span>
      <div class="empty-actions">
        <button onclick={() => workspaceStore.createTodo()}>Create todo.md</button>
        <button onclick={() => workspaceStore.importTodo()}>Import Markdown</button>
      </div>
    {:else}
      <span>Select a workspace folder before creating todo.md.</span>
      <button onclick={() => workspaceStore.chooseRoot()}>Select workspace</button>
    {/if}
  </div>
{:else}
  <TodoList 
    rows={visibleTodos.rows}
    showTodoNumbers={todoUiState.showTodoNumbers}
    selectionActive={todoUiState.hasSelection}
    visiblePositionForStoreIndex={visiblePositionForStoreIndex}
    isTodoSelected={(/** @type {string} */ id) => todoUiState.isSelected(id)}
    inputElements={inputElements}
    onToggleTodo={(/** @type {string} */ id) => todoStore.toggleTodo(id)}
    onUpdateText={(/** @type {string} */ id, /** @type {string} */ text) => todoStore.updateText(id, text)}
    onMoveTodoUp={(/** @type {number} */ index) => todoStore.moveTodoUp(index)}
    onMoveTodoDown={(/** @type {number} */ index) => todoStore.moveTodoDown(index)}
    onMoveTodoToVisiblePosition={moveTodoToVisiblePosition}
    onDeleteTodo={(/** @type {number} */ index) => todoStore.deleteTodo(index)}
    onToggleFold={toggleFold}
    onSelectTodo={handleSelectTodo}
    onSetSelectionAnchor={setSelectionAnchor}
    onClearSelection={clearSelection}
    onOpenContextMenu={openContextMenu}
    onRawContextMenu={handleRawContextMenu}
    onBlankContextMenu={handleBlankContextMenu}
    onFocus={(/** @type {string} */ id, /** @type {string} */ text) => {
      focusedTodoId = id;
      originalTexts[id] = text;
    }}
    onBlur={(/** @type {string} */ id, /** @type {string} */ text) => {
      if (focusedTodoId === id) {
        focusedTodoId = "";
      }
      const oldText = originalTexts[id];
      if (oldText !== undefined && oldText !== text) {
        todoStore.commitTextEdit(id, oldText, text);
      }
      delete originalTexts[id];
      void todoStore.flushSave();
    }}
    onKeyDown={handleKeyDown}
  />
  {#if contextMenu}
    <TodoContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      selectedCount={todoUiState.selectedTodoIds.length}
      onCheckSelected={() => handleSetSelectedChecked(true)}
      onUncheckSelected={() => handleSetSelectedChecked(false)}
      onIndentSelected={() => handleShiftSelectedIndent(1)}
      onOutdentSelected={() => handleShiftSelectedIndent(-1)}
      onDeleteSelected={handleDeleteSelected}
      onClearSelection={handleClearSelectionFromMenu}
    />
  {/if}
{/if}

<svelte:window
  onpointerdown={(event) => {
    if (!contextMenu) return;
    if (event.target instanceof Element && event.target.closest(".todo-context-menu")) return;
    closeContextMenu();
  }}
  onkeydown={(event) => {
    if (contextMenu && event.key === "Escape") {
      event.preventDefault();
      closeContextMenu();
    }
  }}
  onscrollcapture={() => closeContextMenu()}
  onwheel={() => closeContextMenu()}
/>

<style>
  .empty button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 34px;
    padding: 0 16px;
    border: 1px solid var(--border-color);
    border-radius: 5px;
    background: var(--surface-2);
    color: var(--text-color);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 500;
    margin-top: 16px;
  }
  .empty-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .empty-actions button {
    margin-top: 16px;
  }
  .empty button:hover {
    border-color: var(--border-strong);
    background: var(--surface-hover);
  }
</style>
