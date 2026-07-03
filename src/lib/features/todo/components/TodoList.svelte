<script>
  import TodoRow from "./TodoRow.svelte";
  import RawRow from "./RawRow.svelte";

  let { 
    rows, 
    showTodoNumbers = false,
    selectionActive = false,
    visiblePositionForStoreIndex,
    isTodoSelected,
    inputElements, 
    onToggleTodo, 
    onUpdateText, 
    onMoveTodoUp, 
    onMoveTodoDown, 
    onMoveTodoToVisiblePosition,
    onDeleteTodo, 
    onFocus, 
    onBlur, 
    onKeyDown,
    onToggleFold,
    onSelectTodo,
    onSetSelectionAnchor,
    onClearSelection,
    onOpenContextMenu,
    onRawContextMenu,
    onBlankContextMenu
  } = $props();

  let numberDigits = $derived(String(Math.max(1, rows.filter((/** @type {any} */ row) => row.todo.isTodo).length)).length);
</script>

<div
  class="todo-list"
  class:numbered={showTodoNumbers}
  style:--todo-gutter-digits={numberDigits}
  role="list"
  onpointerdown={(event) => {
    if (event.target === event.currentTarget) onClearSelection();
  }}
  oncontextmenu={onBlankContextMenu}
>
  {#each rows as row (row.todo.id)}
    {@const todo = row.todo}
    {@const index = row.storeIndex}
    {#if todo.isTodo}
      <TodoRow 
        todo={todo} 
        index={index} 
        showNumber={showTodoNumbers}
        visiblePosition={visiblePositionForStoreIndex(index)}
        selected={isTodoSelected(todo.id)}
        selectionActive={selectionActive}
        hasChildren={row.hasChildren}
        isFolded={row.isFolded}
        inputElements={inputElements}
        onToggleTodo={onToggleTodo}
        onToggleFold={onToggleFold}
        onUpdateText={onUpdateText}
        onMoveTodoUp={onMoveTodoUp}
        onMoveTodoDown={onMoveTodoDown}
        onMoveTodoToVisiblePosition={onMoveTodoToVisiblePosition}
        onDeleteTodo={onDeleteTodo}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onSelectTodo={onSelectTodo}
        onSetSelectionAnchor={onSetSelectionAnchor}
        onClearSelection={onClearSelection}
        onOpenContextMenu={onOpenContextMenu}
      />
    {:else}
      {#if todo.raw.trim().length > 0}
        <RawRow 
          rawLine={todo} 
          index={index} 
          onDeleteTodo={onDeleteTodo} 
          onRawContextMenu={onRawContextMenu}
        />
      {/if}
    {/if}
  {/each}

  {#if rows.length === 0}
    <div class="empty">
      <strong>No todos</strong>
      <span>Press [+] below to start.</span>
    </div>
  {/if}
</div>
