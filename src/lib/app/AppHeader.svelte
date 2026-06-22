<script>
  import { Settings, Layers, X, Minus, PanelLeft } from "@lucide/svelte";

  let { 
    dragEnabled, 
    layerMode, 
    statusMessage, 
    title = "Tracker",
    onToggleSidebar,
    onToggleModeMenu, 
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
    <button class="icon-btn-header" onclick={onToggleModeMenu} title={layerMode === "desktop" ? "Window mode: Desktop (tray only)" : "Window layer mode"}>
      <Layers size={13} />
      <span class="btn-text">{getModeLabel(layerMode)}</span>
    </button>
    <button class="icon-btn-header" onclick={onToggleSettings} title="Settings">
      <Settings size={13} />
    </button>
    <button class="icon-btn-header" onclick={onShrinkApp} title="Shrink to Tray">
      <Minus size={13} />
    </button>
    <button class="icon-btn-header close" onclick={onCloseApp} title="Close">
      <X size={13} />
    </button>
  </div>
</header>
