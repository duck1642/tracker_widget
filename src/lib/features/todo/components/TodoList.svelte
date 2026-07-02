<script>
  import TodoRow from "./TodoRow.svelte";
  import RawRow from "./RawRow.svelte";

  let { 
    rows, 
    inputElements, 
    onToggleTodo, 
    onUpdateText, 
    onMoveTodoUp, 
    onMoveTodoDown, 
    onDeleteTodo, 
    onFocus, 
    onBlur, 
    onKeyDown,
    onToggleFold
  } = $props();
</script>

<div class="todo-list">
  {#each rows as row (row.todo.id)}
    {@const todo = row.todo}
    {@const index = row.storeIndex}
    {#if todo.isTodo}
      <TodoRow 
        todo={todo} 
        index={index} 
        hasChildren={row.hasChildren}
        isFolded={row.isFolded}
        inputElements={inputElements}
        onToggleTodo={onToggleTodo}
        onToggleFold={onToggleFold}
        onUpdateText={onUpdateText}
        onMoveTodoUp={onMoveTodoUp}
        onMoveTodoDown={onMoveTodoDown}
        onDeleteTodo={onDeleteTodo}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    {:else}
      {#if todo.raw.trim().length > 0}
        <RawRow 
          rawLine={todo} 
          index={index} 
          onDeleteTodo={onDeleteTodo} 
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
