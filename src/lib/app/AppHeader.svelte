<script>
  import { onMount } from "svelte";
  import { Settings, Layers, X, Minus, PanelLeft, ChevronDown } from "@lucide/svelte";
  import LayerMenu from "./LayerMenu.svelte";

  let { 
    dragEnabled, 
    layerMode, 
    statusMessage, 
    title = "Tracker",
    showModeMenu,
    isMaximized = false,
    onToggleSidebar,
    onToggleModeMenu, 
    onDismissModeMenu,
    onSelectMode,
    onToggleSettings, 
    onShrinkApp,
    onMaximizeApp,
    onCloseApp 
  } = $props();

  /** @type {HTMLDivElement | undefined} */
  let modeSelector;
  /** @type {HTMLButtonElement | undefined} */
  let modeTrigger;

  onMount(() => {
    /** @param {PointerEvent} event */
    function handlePointerDown(event) {
      if (showModeMenu && event.target instanceof Node && !modeSelector?.contains(event.target)) onDismissModeMenu?.();
    }

    /** @param {KeyboardEvent} event */
    function handleKeyDown(event) {
      if (!showModeMenu || event.key !== "Escape") return;
      event.preventDefault();
      onDismissModeMenu?.();
      modeTrigger?.focus();
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  /** @param {string} mode */
  function getModeLabel(mode) {
    if (mode === "top") return "Top";
    if (mode === "desktop") return "Desk";
    return "Norm";
  }

  let isWidgetMode = $derived(layerMode === "desktop");
</script>

<header class="drag-header" class:draggable={dragEnabled} data-tauri-drag-region={dragEnabled ? true : undefined}>
  <span class="title-text" data-tauri-drag-region={dragEnabled ? true : undefined}>
    {title} {statusMessage ? `- ${statusMessage}` : ""}
  </span>
  <div class="header-controls">
    <button class="icon-btn-header" onclick={onToggleSidebar} title="Toggle file tree"><PanelLeft size={13} /></button>
    <div class="mode-selector" bind:this={modeSelector}>
      <button class="icon-btn-header mode-trigger" bind:this={modeTrigger} onclick={onToggleModeMenu} title={isWidgetMode ? "Window mode: Widget (tray only)" : "Window layer mode"} aria-haspopup="menu" aria-expanded={showModeMenu}>
        <Layers size={13} />
        <span class="btn-text">{getModeLabel(layerMode)}</span>
        <ChevronDown size={10} />
      </button>
      {#if showModeMenu}<LayerMenu {layerMode} {onSelectMode} />{/if}
    </div>
    <button class="icon-btn-header" onclick={onToggleSettings} title="Settings">
      <Settings size={13} />
    </button>
    <button class="icon-btn-header" onclick={onShrinkApp} title={isWidgetMode ? "Hide to tray" : "Minimize"}>
      <Minus size={13} />
    </button>
    {#if !isWidgetMode}
      <button class="icon-btn-header" onclick={onMaximizeApp} title={isMaximized ? "Restore Down" : "Maximize"}>
        {#if isMaximized}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.1"><path d="M3 1.5H8.5V7H7" /><rect x="1.5" y="3" width="5.5" height="5.5" rx="0.5" /></svg>
        {:else}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="1.5" y="1.5" width="7" height="7" rx="0.5" /></svg>
        {/if}
      </button>
    {/if}
    <button class="icon-btn-header close" onclick={onCloseApp} title="Close">
      <X size={13} />
    </button>
  </div>
</header>

<style>
  .mode-selector { position: relative; display: flex; align-items: center; }
  .mode-trigger { gap: 3px; }
</style>
