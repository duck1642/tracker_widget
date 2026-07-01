<script>
  import { Plus, Undo2, Redo2, RotateCw, ListX } from "@lucide/svelte";

  let { 
    undoStackLength = 0,
    redoStackLength = 0,
    onAddTask, 
    onUndo, 
    onRedo, 
    onReload, 
    onClearCompleted 
  } = $props();
</script>

<footer class="bottom-bar">
  <button class="action-btn" onclick={onAddTask} title="Add todo">
    <Plus size={13} />
  </button>
  <div class="footer-right">
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
