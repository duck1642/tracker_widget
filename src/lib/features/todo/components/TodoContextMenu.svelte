<script>
  import { Trash2, X } from "@lucide/svelte";

  let {
    x = 0,
    y = 0,
    selectedCount = 0,
    onDeleteSelected,
    onClearSelection
  } = $props();
</script>

<div
  class="todo-context-menu"
  style:left={`${x}px`}
  style:top={`${y}px`}
  role="menu"
  aria-label="Todo selection actions"
>
  <div class="context-count">{selectedCount} selected</div>
  <button type="button" role="menuitem" onclick={onDeleteSelected}>
    <Trash2 size={13} />
    <span>Delete selected</span>
  </button>
  <button type="button" role="menuitem" onclick={onClearSelection}>
    <X size={13} />
    <span>Clear selection</span>
  </button>
</div>
