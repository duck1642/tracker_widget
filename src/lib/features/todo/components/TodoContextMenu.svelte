<script>
  import { CheckSquare2, Square, Trash2, X } from "@lucide/svelte";
  import { clampContextMenuPosition } from "$lib/features/todo/todoContextMenuPosition.js";

  let {
    x = 0,
    y = 0,
    selectedCount = 0,
    onCheckSelected,
    onUncheckSelected,
    onDeleteSelected,
    onClearSelection
  } = $props();

  let menuElement = $state();
  let menuLeft = $state(0);
  let menuTop = $state(0);

  $effect(() => {
    const rect = menuElement?.getBoundingClientRect?.();
    const position = clampContextMenuPosition({
      x,
      y,
      width: rect?.width || 168,
      height: rect?.height || 136,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    });
    menuLeft = position.x;
    menuTop = position.y;
  });
</script>

<div
  bind:this={menuElement}
  class="todo-context-menu"
  style:left={`${menuLeft}px`}
  style:top={`${menuTop}px`}
  role="menu"
  aria-label="Todo selection actions"
  tabindex="-1"
  oncontextmenu={(event) => event.preventDefault()}
>
  <div class="context-count">{selectedCount} selected</div>
  <button type="button" role="menuitem" onclick={onCheckSelected}>
    <CheckSquare2 size={13} />
    <span>Check selected</span>
  </button>
  <button type="button" role="menuitem" onclick={onUncheckSelected}>
    <Square size={13} />
    <span>Uncheck selected</span>
  </button>
  <button type="button" role="menuitem" onclick={onDeleteSelected}>
    <Trash2 size={13} />
    <span>Delete selected</span>
  </button>
  <button type="button" role="menuitem" onclick={onClearSelection}>
    <X size={13} />
    <span>Clear selection</span>
  </button>
</div>
