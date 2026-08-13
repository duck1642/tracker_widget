<script>
  import { tick } from "svelte";
  import { Check, ChevronDown, ChevronRight } from "@lucide/svelte";

  let { 
    todo, 
    index, 
    showNumber = false,
    visiblePosition = 0,
    selected = false,
    selectionActive = false,
    hasChildren = false,
    isFolded = false,
    inputElements, 
    onToggleTodo, 
    onToggleFold,
    onUpdateText, 
    onMoveTodoToVisiblePosition,
    onFocus, 
    onBlur, 
    onKeyDown,
    onSelectTodo,
    onSetSelectionAnchor,
    onClearSelection,
    onOpenContextMenu
  } = $props();

  /** @type {HTMLTextAreaElement | undefined} */
  let inputEl = $state();
  /** @type {HTMLInputElement | undefined} */
  let targetInputEl = $state();
  let editingMoveTarget = $state(false);
  let moveTargetValue = $state("");

  /** @param {HTMLTextAreaElement} textarea */
  function resizeTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

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

  /** @param {EventTarget | null} target */
  function isSelectionIgnoredTarget(target) {
    return target instanceof Element && Boolean(target.closest(".row-actions, .fold-btn, .todo-index-input"));
  }

  /** @param {PointerEvent} event */
  function handleRowPointerDown(event) {
    if (event.button === 2) return;
    if (isSelectionIgnoredTarget(event.target)) return;
    if (event.ctrlKey || event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      onSelectTodo(event, todo.id);
    } else if (selectionActive) {
      onClearSelection();
      onSetSelectionAnchor(todo.id);
    } else {
      onSetSelectionAnchor(todo.id);
    }
  }

  $effect(() => {
    todo.text;
    if (inputEl) {
      resizeTextarea(inputEl);
    }
  });

  $effect(() => {
    if (!inputEl || typeof ResizeObserver === "undefined") return;
    
    let prevWidth = inputEl.clientWidth;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width !== prevWidth) {
          prevWidth = width;
          if (inputEl) resizeTextarea(inputEl);
        }
      }
    });
    
    resizeObserver.observe(inputEl);
    
    return () => {
      resizeObserver.disconnect();
    };
  });

  /** @param {Event & { currentTarget: HTMLTextAreaElement }} event */
  function handleInput(event) {
    const value = event.currentTarget.value.replace(/\r?\n/g, " ");
    onUpdateText(todo.id, value);
    resizeTextarea(event.currentTarget);
  }
</script>

<div
  class="todo-row"
  class:selected={selected}
  style="padding-left: {todo.indent * 20}px"
  onpointerdown={handleRowPointerDown}
  oncontextmenu={(event) => onOpenContextMenu(event, todo.id)}
  role="listitem"
>
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
        onclick={(event) => {
          if (event.ctrlKey || event.shiftKey) return;
          openMoveTarget();
        }}
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
    onclick={(event) => {
      if (event.ctrlKey || event.shiftKey) return;
      onToggleTodo(todo.id);
    }}
    title={todo.checked ? "Mark active" : "Mark completed"}
  >
    {#if todo.checked}
      <Check size={12} strokeWidth={4} />
    {/if}
  </button>
  <textarea 
    class="todo-text {todo.checked ? 'completed' : ''}" 
    value={todo.text}
    bind:this={inputEl}
    onfocus={() => onFocus(todo.id, todo.text)}
    onblur={() => onBlur(todo.id, todo.text)}
    oninput={handleInput}
    onkeydown={(e) => onKeyDown(e, index, todo)}
    readonly={selectionActive}
    placeholder="New todo"
    rows="1"
  ></textarea>
</div>
