<script>
  import { Settings, Layers, X, Minus, PanelLeft, ChevronDown } from "@lucide/svelte";
  import LayerMenu from "./LayerMenu.svelte";

  let { 
    dragEnabled, 
    layerMode, 
    statusMessage, 
    title = "Tracker",
    showModeMenu,
    onToggleSidebar,
    onToggleModeMenu, 
    onSelectMode,
    onToggleSettings, 
    onShrinkApp,
    onCloseApp 
  } = $props();

  /** @param {string} mode */
  function getModeLabel(mode) {
    if (mode === "top") return "Top";
    if (mode === "desktop") return "Desk";
    return "Norm";
  }
</script>

<header class="drag-header" class:draggable={dragEnabled} data-tauri-drag-region={dragEnabled ? true : undefined}>
  <span class="title-text" data-tauri-drag-region={dragEnabled ? true : undefined}>
    {title} {statusMessage ? `· ${statusMessage}` : ""}
  </span>
  <div class="header-controls">
    <button class="icon-btn-header" onclick={onToggleSidebar} title="Toggle file tree"><PanelLeft size={13} /></button>
    <div class="mode-selector">
      <button class="icon-btn-header mode-trigger" onclick={onToggleModeMenu} title={layerMode === "desktop" ? "Window mode: Desktop (tray only)" : "Window layer mode"} aria-haspopup="menu" aria-expanded={showModeMenu}>
        <Layers size={13} />
        <span class="btn-text">{getModeLabel(layerMode)}</span>
        <ChevronDown size={10} />
      </button>
      {#if showModeMenu}<LayerMenu {layerMode} {onSelectMode} />{/if}
    </div>
    <button class="icon-btn-header" onclick={onToggleSettings} title="Settings">
      <Settings size={13} />
    </button>
    <button class="icon-btn-header" onclick={onShrinkApp} title={layerMode === "desktop" ? "Hide to tray" : "Minimize"}>
      <Minus size={13} />
    </button>
    <button class="icon-btn-header close" onclick={onCloseApp} title="Close">
      <X size={13} />
    </button>
  </div>
</header>

<style>
  .mode-selector { position: relative; display: flex; align-items: center; }
  .mode-trigger { gap: 3px; }
</style>
