<script>
  import { ChevronsDownUp, ChevronsUpDown, ListOrdered, Plus, Undo2, Redo2, RotateCw, ListX } from "@lucide/svelte";
  import { todoFoldStore } from "$lib/features/todo/todoFolding.svelte.js";
  import { todoUiState } from "$lib/features/todo/todoUiState.svelte.js";

  let { 
    undoStackLength = 0,
    redoStackLength = 0,
    onAddTodo, 
    onUndo, 
    onRedo, 
    onReload, 
    onClearCompleted 
  } = $props();
</script>

<footer class="bottom-bar">
  <button class="action-btn" onclick={onAddTodo} title="Add todo">
    <Plus size={13} />
  </button>
  <div class="footer-right">
    <button
      class="action-btn"
      onclick={() => todoUiState.toggleTodoNumbers()}
      aria-label={todoUiState.showTodoNumbers ? "Hide todo numbers" : "Show todo numbers"}
      title={todoUiState.showTodoNumbers ? "Hide todo numbers" : "Show todo numbers"}
    >
      <ListOrdered size={13} />
    </button>
    <button
      class="action-btn"
      onclick={() => {
        todoUiState.clearSelection();
        todoFoldStore.hasCollapsedTodos ? todoFoldStore.expandAll() : todoFoldStore.collapseAll();
      }}
      disabled={!todoFoldStore.hasFoldableTodos}
      aria-label={todoFoldStore.hasCollapsedTodos ? "Expand all todos" : "Collapse all todos"}
      title={todoFoldStore.hasCollapsedTodos ? "Expand all todos" : "Collapse all todos"}
    >
      {#if todoFoldStore.hasCollapsedTodos}<ChevronsUpDown size={13} />{:else}<ChevronsDownUp size={13} />{/if}
    </button>
    <button class="action-btn" onclick={onUndo} disabled={undoStackLength === 0} title="Undo last action">
      <Undo2 size={13} />
    </button>
    <button class="action-btn" onclick={onRedo} disabled={redoStackLength === 0} title="Redo last undone action">
      <Redo2 size={13} />
    </button>
    <button class="action-btn" onclick={onReload} title="Reload file">
      <RotateCw size={13} />
    </button>
    <button class="action-btn del" onclick={onClearCompleted} aria-label="Clear completed todos" title="Clear completed todos">
      <ListX size={13} />
    </button>
  </div>
</footer>
