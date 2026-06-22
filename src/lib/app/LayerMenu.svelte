<script>
  import { Check } from "@lucide/svelte";
  let { layerMode, onSelectMode } = $props();
  const modes = [
    { id: "top", label: "Always on Top" },
    { id: "normal", label: "Normal Window" },
    { id: "desktop", label: "Pin to Desktop", detail: "Tray only" }
  ];
</script>

<div class="dropdown-menu" role="menu" aria-label="Window mode">
  {#each modes as mode}
    <button class="menu-item" class:active={layerMode === mode.id} role="menuitemradio" aria-checked={layerMode === mode.id} onclick={() => onSelectMode(mode.id)}>
      <span><strong>{mode.label}</strong>{#if mode.detail}<small>{mode.detail}</small>{/if}</span>
      {#if layerMode === mode.id}<Check size={13} />{/if}
    </button>
  {/each}
</div>

<style>
  .dropdown-menu { position: absolute; top: calc(100% + 5px); right: 0; z-index: 1000; display: grid; width: 176px; padding: 4px; border: 1px solid var(--border-strong); border-radius: 6px; background: var(--bg-header); box-shadow: 0 10px 24px rgba(0, 0, 0, .38); }
  .menu-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-height: 34px; padding: 6px 8px; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); text-align: left; cursor: pointer; }
  .menu-item:hover { background: var(--surface-hover); color: var(--text-color); }
  .menu-item.active { background: var(--accent-soft); color: var(--accent); }
  .menu-item span { display: grid; gap: 1px; }
  strong { font-size: 11px; font-weight: 650; }
  small { color: var(--text-muted); font-size: 9px; }
</style>
