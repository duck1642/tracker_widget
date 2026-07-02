<script>
  import TodoRow from "./TodoRow.svelte";
  import RawRow from "./RawRow.svelte";

  let { 
    todos, 
    inputElements, 
    onToggleTodo, 
    onUpdateText, 
    onMoveTodoUp, 
    onMoveTodoDown, 
    onDeleteTodo, 
    onFocus, 
    onBlur, 
    onKeyDown 
  } = $props();
</script>

<div class="todo-list">
  {#each todos as todo, index (todo.id)}
    {#if todo.isTodo}
      <TodoRow 
        todo={todo} 
        index={index} 
        inputElements={inputElements}
        onToggleTodo={onToggleTodo}
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

  {#if todos.length === 0}
    <div class="empty">
      <strong>No todos</strong>
      <span>Press [+] below to start.</span>
    </div>
  {/if}
</div>
