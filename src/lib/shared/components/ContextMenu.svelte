<script>
  import { clampContextMenuPosition } from "$lib/shared/services/contextMenuPosition.js";

  let {
    x = 0,
    y = 0,
    items = [],
    ariaLabel = "Context actions"
  } = $props();

  let menuElement = $state();
  let menuLeft = $state(0);
  let menuTop = $state(0);

  $effect(() => {
    const rect = menuElement?.getBoundingClientRect?.();
    const position = clampContextMenuPosition({
      x,
      y,
      width: rect?.width || 196,
      height: rect?.height || 150,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    });
    menuLeft = position.x;
    menuTop = position.y;
  });
</script>

<div
  bind:this={menuElement}
  class="context-menu"
  style:left={`${menuLeft}px`}
  style:top={`${menuTop}px`}
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
