<script>
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import * as fileService from "$lib/services/fileService.js";
  import { appStore } from "$lib/stores/appStore.js";
  import { documentStore } from "$lib/stores/documentStore.js";
  import "$lib/styles/app.css";
  import AppHeader from "$lib/components/AppHeader.svelte";
  import LayerMenu from "$lib/components/LayerMenu.svelte";
  import BottomBar from "$lib/components/BottomBar.svelte";
  import SettingsPanel from "$lib/components/SettingsPanel.svelte";
  
  // Panels
  import TasksPanel from "$lib/components/panels/TasksPanel.svelte";
  import WeekPanel from "$lib/components/panels/WeekPanel.svelte";
  import DayPanel from "$lib/components/panels/DayPanel.svelte";

  // Settings state
  let editingPath = $state(false);
  let pathInputVal = $state("");
  let showModeMenu = $state(false);

  onMount(() => {
    (async () => {
      await appStore.loadConfig();
      pathInputVal = appStore.filePath;
      await documentStore.loadFile();
    })();

    // Focus-based refresh
    const handleFocus = async () => {
      if (!appStore.filePath || editingPath) return;
      try {
        const modTime = await fileService.getFileModifiedTime(appStore.filePath);
        if (modTime !== documentStore.lastModified) {
          await documentStore.loadFile();
        }
      } catch (e) {
        // Skip locked files
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  });

  async function savePath() {
    const newPath = pathInputVal.trim();
    if (!newPath) return;

    const oldPath = appStore.filePath;
    appStore.filePath = newPath;

    const ok = await documentStore.loadFile();
    if (!ok) {
      appStore.filePath = oldPath;
      pathInputVal = oldPath;
      return;
    }

    editingPath = false;
    await appStore.saveConfig();
  }

  function cancelPathEdit() {
    pathInputVal = appStore.filePath;
    editingPath = false;
  }

  function shrinkApp() {
    getCurrentWindow().hide();
  }

  function closeApp() {
    getCurrentWindow().close();
  }
</script>

<main class="app-container" class:desktop-mode={appStore.layerMode === 'desktop'}>
  <!-- Title / Drag Header -->
  <AppHeader 
    dragEnabled={appStore.dragEnabled}
    layerMode={appStore.layerMode}
    statusMessage={appStore.statusMessage}
    onToggleModeMenu={() => showModeMenu = !showModeMenu}
    onToggleSettings={() => {
      editingPath = !editingPath;
      if (editingPath) pathInputVal = appStore.filePath;
    }}
    onShrinkApp={shrinkApp}
    onCloseApp={closeApp}
  />

  <!-- Content Workspace -->
  <div class="content-area" style="position: relative; display: flex; flex-direction: column; flex: 1; overflow: hidden;">
    {#if showModeMenu}
      <LayerMenu layerMode={appStore.layerMode} onSelectMode={(/** @type {string} */ mode) => {
        appStore.changeLayerMode(mode);
        showModeMenu = false;
      }} />
    {/if}
    {#if editingPath}
      <SettingsPanel 
        bind:pathInputVal={pathInputVal}
        dragEnabled={appStore.dragEnabled}
        autostartEnabled={appStore.autostartEnabled}
        onSave={savePath}
        onCancel={cancelPathEdit}
        onToggleDrag={() => appStore.toggleDrag()}
        onToggleAutostart={() => appStore.toggleAutostart()}
      />
    {:else}
      <!-- TABS BAR / NAVIGATION -->
      <div class="tabs-nav">
        <button class="tab-btn" class:active={appStore.currentView === 'tasks'} onclick={() => appStore.currentView = 'tasks'}>Tasks</button>
        <button class="tab-btn" class:active={appStore.currentView === 'week'} onclick={() => appStore.currentView = 'week'}>Week</button>
        <button class="tab-btn" class:active={appStore.currentView === 'day'} onclick={() => appStore.currentView = 'day'}>Today</button>
      </div>

      <div class="panel-content" style="flex: 1; overflow-y: auto;">
        {#if appStore.currentView === 'tasks'}
          <TasksPanel />
        {:else if appStore.currentView === 'week'}
          <WeekPanel />
        {:else if appStore.currentView === 'day'}
          <DayPanel />
        {/if}
      </div>
    {/if}
  </div>

  <!-- Bottom Action Bar (only visible when in tasks mode) -->
  {#if !editingPath && appStore.currentView === 'tasks'}
    <BottomBar 
      redoStackLength={documentStore.redoStack.length}
      onAddTask={() => documentStore.addTask(-1, 0)}
      onUndo={() => documentStore.undo()}
      onRedo={() => documentStore.redo()}
      onReload={() => documentStore.loadFile()}
      onClearCompleted={() => documentStore.clearCompleted()}
    />
  {/if}
</main>

<style>
  .tabs-nav {
    display: flex;
    gap: 4px;
    padding: 6px 12px;
    background: rgba(20, 20, 25, 0.5);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .tab-btn {
    flex: 1;
    background: transparent;
    border: none;
    padding: 5px 8px;
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .tab-btn:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.03);
  }
  .tab-btn.active {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }
</style>
