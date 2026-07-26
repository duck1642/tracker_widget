<script>
  import { clampContextMenuPosition } from "$lib/shared/services/contextMenuPosition.js";

  let {
    x = 0,
    y = 0,
    items = [],
    ariaLabel = "Context actions",
    preserveFocus = false,
    width = 196,
    onDismiss = null
  } = $props();

  let menuElement = $state();
  let menuLeft = $state(0);
  let menuTop = $state(0);

  $effect(() => {
    const rect = menuElement?.getBoundingClientRect?.();
    const position = clampContextMenuPosition({
      x,
      y,
      width: rect?.width || width,
      height: rect?.height || 150,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    });
    menuLeft = position.x;
    menuTop = position.y;
  });

  function dismiss() {
    onDismiss?.();
  }

  /** @param {PointerEvent} event */
  function handleWindowPointerDown(event) {
    if (!onDismiss) return;
    if (event.target instanceof Node && menuElement?.contains(event.target)) return;
    dismiss();
  }

  /** @param {KeyboardEvent} event */
  function handleWindowKeydown(event) {
    if (!onDismiss || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  }
</script>

<svelte:window
  onpointerdown={handleWindowPointerDown}
  onkeydown={handleWindowKeydown}
  onscrollcapture={dismiss}
  onwheel={dismiss}
/>

<div
  bind:this={menuElement}
  class="context-menu todo-context-menu"
  style:left={`${menuLeft}px`}
  style:top={`${menuTop}px`}
  style:width={`${width}px`}
  role="menu"
  aria-label={ariaLabel}
  tabindex="-1"
  oncontextmenu={(event) => event.preventDefault()}
>
  {#each items as item}
    {#if item.separator}
      <div class="context-separator" aria-hidden="true"></div>
    {:else if item.isHeader}
      <div class="context-count">{item.label}</div>
    {:else}
      <button
        type="button"
        role="menuitem"
        class:danger-item={item.danger}
        disabled={item.disabled}
        onpointerdown={(event) => { if (preserveFocus) event.preventDefault(); }}
        onclick={item.onclick}
      >
        {#if item.icon}
          {@const Icon = item.icon}
          <Icon size={13} />
        {/if}
        <span>{item.label}</span>
      </button>
    {/if}
  {/each}
</div>
