<script>
  // @ts-nocheck
  import { onMount } from "svelte";
  import {
    ArrowLeft,
    ArrowRight,
    CalendarCheck,
    CalendarPlus,
    CalendarRange,
    CheckSquare2,
    ChevronDown,
    ExternalLink,
    Layers,
    Minus,
    PanelLeftClose,
    PanelLeftOpen,
    Settings,
    X
  } from "@lucide/svelte";
  import ContextMenu from "$lib/shared/components/ContextMenu.svelte";
  import LayerMenu from "./LayerMenu.svelte";

  let { 
    dragEnabled, 
    layerMode, 
    title = "Tracker",
    currentView = "todo",
    sidebarOpen = true,
    showModeMenu,
    isMaximized = false,
    onToggleSidebar,
    canGoBack = false,
    canGoForward = false,
    onBack,
    onForward,
    onToggleModeMenu, 
    onDismissModeMenu,
    onSelectMode,
    onToggleSettings, 
    onOpenView,
    onOpenActiveFile,
    onCreateCurrentWeek,
    onCreateNextWeek,
    onChooseWeeks,
    onOpenHelp,
    onShrinkApp,
    onMaximizeApp,
    onCloseApp 
  } = $props();

  /** @type {HTMLDivElement | undefined} */
  let modeSelector;
  /** @type {HTMLButtonElement | undefined} */
  let modeTrigger;
  let appMenu = $state(null);
  let appMenuItems = $derived.by(() => {
    if (appMenu?.kind === "file") {
      return [
        { label: "Open Active Markdown", icon: ExternalLink, onclick: () => runMenuAction(onOpenActiveFile) },
        { separator: true },
        { label: "Check/Repair Current Week", icon: CalendarCheck, onclick: () => runMenuAction(onCreateCurrentWeek) },
        { label: "Create Next Week", icon: CalendarPlus, onclick: () => runMenuAction(onCreateNextWeek) },
        { label: "Choose Weeks…", icon: CalendarRange, onclick: () => runMenuAction(onChooseWeeks) }
      ];
    }
    if (appMenu?.kind === "view") {
      return [
        { label: "Todo", icon: CheckSquare2, disabled: currentView === "todo", onclick: () => runMenuAction(onOpenView, "todo") },
        { label: "Current Week", icon: CalendarRange, disabled: currentView === "week", onclick: () => runMenuAction(onOpenView, "week") },
        { label: "Today", icon: CalendarCheck, disabled: currentView === "day", onclick: () => runMenuAction(onOpenView, "day") },
        { separator: true },
        { label: sidebarOpen ? "Hide Sidebar" : "Show Sidebar", icon: sidebarOpen ? PanelLeftClose : PanelLeftOpen, onclick: () => runMenuAction(onToggleSidebar) }
      ];
    }
    return [];
  });

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

  function toggleAppMenu(event, kind) {
    onDismissModeMenu?.();
    if (appMenu?.kind === kind) {
      appMenu = null;
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    appMenu = { kind, x: rect.left, y: rect.bottom + 4 };
  }

  function runMenuAction(action, ...args) {
    appMenu = null;
    action?.(...args);
  }

  function toggleModeMenu() {
    appMenu = null;
    onToggleModeMenu?.();
  }

  let isWidgetMode = $derived(layerMode === "desktop");
</script>

<header class="drag-header" class:draggable={dragEnabled} data-tauri-drag-region={dragEnabled ? true : undefined}>
  <div class="header-leading">
    <div class="navigation-controls" role="group" aria-label="Navigation controls">
      <button class="icon-btn-header stateful-control" class:active={sidebarOpen} onclick={onToggleSidebar} aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"} title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}>
        {#if sidebarOpen}<PanelLeftClose size={14} />{:else}<PanelLeftOpen size={14} />{/if}
      </button>
      <button class="icon-btn-header" onclick={onBack} disabled={!canGoBack} aria-label="Back" title="Back (Alt+Left)"><ArrowLeft size={14} /></button>
      <button class="icon-btn-header" onclick={onForward} disabled={!canGoForward} aria-label="Forward" title="Forward (Alt+Right)"><ArrowRight size={14} /></button>
      <button class="icon-btn-header" onclick={onToggleSettings} aria-label="Settings" title="Settings"><Settings size={14} /></button>
    </div>
    <nav class="menu-bar" aria-label="Application menus">
      <button class="menu-trigger" onclick={(event) => toggleAppMenu(event, "file")} aria-haspopup="menu" aria-expanded={appMenu?.kind === "file"}>File</button>
      <button class="menu-trigger" onclick={(event) => toggleAppMenu(event, "view")} aria-haspopup="menu" aria-expanded={appMenu?.kind === "view"}>View</button>
      <button class="menu-trigger" onclick={() => runMenuAction(onOpenHelp)}>Help</button>
    </nav>
  </div>
  <span class="title-text" data-tauri-drag-region={dragEnabled ? true : undefined}>
    {title}
  </span>
  <div class="header-controls">
    <div class="app-controls" role="group" aria-label="Application controls">
      <div class="mode-selector" bind:this={modeSelector}>
        <button class="icon-btn-header mode-trigger" bind:this={modeTrigger} onclick={toggleModeMenu} title={isWidgetMode ? "Window mode: Widget (tray only)" : "Window layer mode"} aria-haspopup="menu" aria-expanded={showModeMenu}>
          <Layers size={13} />
          <span class="btn-text">{getModeLabel(layerMode)}</span>
          <ChevronDown size={10} />
        </button>
        {#if showModeMenu}<LayerMenu {layerMode} {onSelectMode} />{/if}
      </div>
    </div>
    <div class="window-controls" role="group" aria-label="Window controls">
      <button class="icon-btn-header window-control" onclick={onShrinkApp} title={isWidgetMode ? "Hide to tray" : "Minimize"}>
        <Minus size={13} />
      </button>
      {#if !isWidgetMode}
        <button class="icon-btn-header window-control" onclick={onMaximizeApp} title={isMaximized ? "Restore Down" : "Maximize"}>
          {#if isMaximized}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.1"><path d="M3 1.5H8.5V7H7" /><rect x="1.5" y="3" width="5.5" height="5.5" rx="0.5" /></svg>
          {:else}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="1.5" y="1.5" width="7" height="7" rx="0.5" /></svg>
          {/if}
        </button>
      {/if}
      <button class="icon-btn-header window-control close" onclick={onCloseApp} title="Close">
        <X size={13} />
      </button>
    </div>
  </div>
</header>

{#if appMenu}
  <ContextMenu
    x={appMenu.x}
    y={appMenu.y}
    items={appMenuItems}
    ariaLabel={`${appMenu.kind === "file" ? "File" : "View"} menu`}
    width={190}
    onDismiss={() => appMenu = null}
  />
{/if}

<style>
  .header-leading,
  .navigation-controls,
  .menu-bar { display: flex; align-items: center; }
  .header-leading { min-width: 0; gap: 7px; }
  .navigation-controls { gap: 2px; }
  .stateful-control.active { color: var(--accent); background: var(--accent-soft); }
  .menu-bar { align-self: stretch; gap: 1px; }
  .menu-trigger {
    height: 100%;
    padding: 0 7px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
  }
  .menu-trigger:hover,
  .menu-trigger[aria-expanded="true"] { color: var(--text-color); background: var(--surface-hover); }
  .mode-selector { position: relative; display: flex; align-items: center; }
  .mode-trigger { gap: 3px; }
  .header-controls,
  .app-controls,
  .window-controls { display: flex; align-items: center; }
  .header-controls { align-self: stretch; gap: 8px; }
  .app-controls { gap: 4px; }
  .window-controls { gap: 0; }
  .window-control {
    width: 36px;
    height: 32px;
    justify-content: center;
    padding: 0;
    border-radius: 0;
  }
  .window-control:hover {
    color: var(--text-color);
    background: var(--surface-hover);
  }
  .window-control.close:hover {
    color: #fff;
    background: #c42b1c;
  }
  :global(.icon-btn-header:disabled) { opacity: 0.35; cursor: default; }
</style>
