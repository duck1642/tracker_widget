<script>
  let { layerMode, onSelectMode } = $props();
</script>

<div class="dropdown-menu">
  <button class="menu-item" class:active={layerMode === 'top'} onclick={() => onSelectMode("top")}>
    Always on Top
  </button>
  <button class="menu-item" class:active={layerMode === 'normal'} onclick={() => onSelectMode("normal")}>
    Normal Window
  </button>
  <button class="menu-item" class:active={layerMode === 'desktop'} onclick={() => onSelectMode("desktop")}>
    Pin to Desktop (tray only)
  </button>
</div>
