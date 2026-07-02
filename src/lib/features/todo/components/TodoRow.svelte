<script>
  import { tick } from "svelte";
  import { Check, ChevronDown, ChevronRight, ChevronUp, Trash2 } from "@lucide/svelte";

  let { 
    todo, 
    index, 
    showNumber = false,
    visiblePosition = 0,
    hasChildren = false,
    isFolded = false,
    inputElements, 
    onToggleTodo, 
    onToggleFold,
    onUpdateText, 
    onMoveTodoUp, 
    onMoveTodoDown, 
    onMoveTodoToVisiblePosition,
    onDeleteTodo, 
    onFocus, 
    onBlur, 
    onKeyDown 
  } = $props();

  let inputEl = $state();
  let targetInputEl = $state();
  let editingMoveTarget = $state(false);
  let moveTargetValue = $state("");


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

  async function openMoveTarget() {
    editingMoveTarget = true;
    moveTargetValue = String(visiblePosition);
    await tick();
    targetInputEl?.focus();
    targetInputEl?.select();
  }

  async function commitMoveTarget() {
    const targetPosition = Number(moveTargetValue);
    editingMoveTarget = false;
    await onMoveTodoToVisiblePosition(index, targetPosition);
  }
</script>

<div class="todo-row" style="padding-left: {todo.indent * 16}px">
  {#if showNumber}
    {#if editingMoveTarget}
      <input
        bind:this={targetInputEl}
        class="todo-index-input"
        type="text"
        inputmode="numeric"
        value={moveTargetValue}
        oninput={(event) => moveTargetValue = event.currentTarget.value}
        onblur={() => editingMoveTarget = false}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            commitMoveTarget();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            editingMoveTarget = false;
          }
        }}
        aria-label="Todo target position"
      />
    {:else}
      <button
        type="button"
        class="todo-index-btn"
        onclick={openMoveTarget}
        aria-label={`Move todo ${visiblePosition}`}
        title="Move todo to position"
      >
        {visiblePosition}
      </button>
    {/if}
  {/if}
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
