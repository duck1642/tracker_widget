<script>
  import { Check, ChevronDown, ChevronRight, ChevronUp, Trash2 } from "@lucide/svelte";

  let { 
    todo, 
    index, 
    hasChildren = false,
    isFolded = false,
    inputElements, 
    onToggleTodo, 
    onToggleFold,
    onUpdateText, 
    onMoveTodoUp, 
    onMoveTodoDown, 
    onDeleteTodo, 
    onFocus, 
    onBlur, 
    onKeyDown 
  } = $props();

  let inputEl = $state();


  $effect(() => {
    if (inputEl && inputElements) {
      inputElements[todo.id] = inputEl;
    }
    return () => {
      if (inputElements) {
        delete inputElements[todo.id];
      }
    };
  });
</script>

<div class="todo-row" style="padding-left: {todo.indent * 16}px">
  {#if hasChildren}
    <button
      type="button"
      class="fold-btn"
      onclick={() => onToggleFold(todo.id)}
      aria-label={isFolded ? "Expand todo" : "Collapse todo"}
      title={isFolded ? "Expand todo" : "Collapse todo"}
    >
      {#if isFolded}<ChevronRight size={13} />{:else}<ChevronDown size={13} />{/if}
    </button>
  {:else}
    <span class="fold-placeholder" aria-hidden="true"></span>
  {/if}
  <button 
    type="button"
    class="custom-check-btn {todo.checked ? 'checked' : ''}" 
    onclick={() => onToggleTodo(todo.id)}
    title={todo.checked ? "Mark active" : "Mark completed"}
  >
    {#if todo.checked}
      <Check size={10} strokeWidth={4} />
    {/if}
  </button>
  <input 
    type="text" 
    class="todo-text {todo.checked ? 'completed' : ''}" 
    value={todo.text}
    bind:this={inputEl}
    onfocus={() => onFocus(todo.id, todo.text)}
    onblur={() => onBlur(todo.id, todo.text)}
    oninput={(e) => onUpdateText(todo.id, e.currentTarget.value)}
    onkeydown={(e) => onKeyDown(e, index, todo)}
    placeholder="New todo"
  />
  <div class="row-actions">
    <button type="button" class="row-btn" onpointerdown={(event) => event.preventDefault()} onclick={() => onMoveTodoUp(index)} aria-label="Move todo up" title="Move up">
      <ChevronUp size={13} />
    </button>
    <button type="button" class="row-btn" onpointerdown={(event) => event.preventDefault()} onclick={() => onMoveTodoDown(index)} aria-label="Move todo down" title="Move down">
      <ChevronDown size={13} />
    </button>
    <button type="button" class="row-btn del" onpointerdown={(event) => event.preventDefault()} onclick={() => onDeleteTodo(index)} aria-label="Delete todo" title="Delete">
      <Trash2 size={13} />
    </button>
  </div>
</div>
