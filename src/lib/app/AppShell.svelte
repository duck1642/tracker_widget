<script>
  // @ts-nocheck
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
  import { appStore } from "./appStore.svelte.js";
  import { workspaceStore } from "./workspaceStore.svelte.js";
  import { subjectHistoryStore } from "./subjectHistoryStore.svelte.js";
  import { sessionHistoryStore } from "./sessionHistoryStore.svelte.js";
  import { persistenceRegistry } from "./persistenceRegistry.js";
  import { todoStore } from "$lib/features/todo/todoStore.svelte.js";
  import { todoUiState } from "$lib/features/todo/todoUiState.svelte.js";
  import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
  import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
  import { formatDate, getWeekDescriptor } from "$lib/shared/services/logWorkspaceService.js";
  import AppHeader from "./AppHeader.svelte";
  import SettingsPanel from "./SettingsPanel.svelte";
  import MainTabs from "./MainTabs.svelte";
  import AppSidebar from "./AppSidebar.svelte";
  import TodoPanel from "$lib/features/todo/components/TodoPanel.svelte";
  import TodoToolbar from "$lib/features/todo/components/TodoToolbar.svelte";
  import DailyPanel from "$lib/features/daily/components/DailyPanel.svelte";
  import WeekPanel from "$lib/features/weekly/components/WeekPanel.svelte";
  import ConflictBanner from "$lib/shared/components/ConflictBanner.svelte";

  let editingSettings = $state(false);
  let showModeMenu = $state(false);
  let selectedPath = $state("");
  let isMaximized = $state(false);

  const viewSizeConstraints = {
    todo: { width: 480, height: 360 },
    day: { width: 900, height: 620 },
    week: { width: 1280, height: 700 }
  };

  function descriptorFor(week) {
    const date = week.days[0]?.date ? new Date(`${week.days[0].date}T12:00:00`) : new Date();
    return getWeekDescriptor(date);
  }

  async function selectWeek(week) {
    if (!week.indexPath) return;
    todoUiState.clearSelection();
    selectedPath = week.indexPath;
    appStore.currentView = "week";
    await weekStore.loadPath(week.indexPath, descriptorFor(week), week.days);
  }

  async function selectDay(day, week) {
    todoUiState.clearSelection();
    selectedPath = day.path;
    if (week.indexPath && weekStore.path !== week.indexPath) {
      await weekStore.loadPath(week.indexPath, descriptorFor(week), week.days);
    }
    appStore.currentView = "day";
    await dailyStore.loadPath(day.path, day.date);
  }

  async function openCurrent(kind) {
    if (kind !== "todo") todoUiState.clearSelection();
    const today = formatDate(new Date());
    const weekName = getWeekDescriptor(new Date()).folderName;
    const week = workspaceStore.weeks.find((item) => item.name === weekName);
    if (kind === "day") {
      const day = week?.days.find((item) => item.date === today);
      if (day) return await selectDay(day, week);
    } else if (kind === "week" && week?.indexPath) {
      return await selectWeek(week);
    }
    appStore.currentView = kind;
  }

  async function applyViewSizeConstraints(view) {
    const constraints = viewSizeConstraints[view] ?? viewSizeConstraints.todo;
    const sidebarWidth = (workspaceStore.sidebarOpen && !workspaceStore.needsFirstSetup) ? 180 : 0;
    const targetWidth = constraints.width + sidebarWidth;
    const targetHeight = constraints.height;

    try {
      const appWindow = getCurrentWindow();
      await appWindow.setMinSize(new LogicalSize(targetWidth, targetHeight));
      if (await appWindow.isMaximized()) return;

      const scaleFactor = await appWindow.scaleFactor();
      const logicalSize = (await appWindow.innerSize()).toLogical(scaleFactor);
      if (logicalSize.width < targetWidth || logicalSize.height < targetHeight) {
        await appWindow.setSize(new LogicalSize(
          Math.max(logicalSize.width, targetWidth),
          Math.max(logicalSize.height, targetHeight)
        ));
      }
    } catch (error) {
      appStore.showStatus("Window size update failed: " + error);
    }
  }

  $effect(() => {
    const view = appStore.currentView;
    const sidebarOpen = workspaceStore.sidebarOpen; // establish reactive dependency
    if (!view) return;
    if (isMaximized) return;
    applyViewSizeConstraints(view);
  });

  onMount(() => {
    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlistenClose;
    let unlistenQuit;
    let unlistenResized;
    const handleResize = async () => {
      try {
        isMaximized = await appWindow.isMaximized();
      } catch (err) {
        // Safe fallback if permission is not yet loaded or initialized
      }
      setTimeout(async () => {
        try {
          isMaximized = await appWindow.isMaximized();
        } catch {}
      }, 100);
      setTimeout(async () => {
        try {
          isMaximized = await appWindow.isMaximized();
        } catch {}
      }, 300);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    (async () => {
      try {
        unlistenResized = await appWindow.onResized(handleResize);
        if (disposed) unlistenResized();
      } catch {}
      unlistenQuit = await listen("request-quit", async () => {
        if (await persistenceRegistry.flushAll()) await invoke("exit_app");
        else appStore.showStatus("Resolve file conflicts before quitting");
      });
      await appStore.loadConfig();
      await workspaceStore.refresh();
      await subjectHistoryStore.load(appStore.logsRootPath);
      await sessionHistoryStore.load(appStore.logsRootPath);
      if (appStore.filePath) await todoStore.loadFile();
      unlistenClose = await appWindow.onCloseRequested(async (event) => {
        event.preventDefault();
        if (!(await persistenceRegistry.flushAll())) return appStore.showStatus("Resolve file conflicts before closing");
        try {
          await appWindow.hide();
        } catch (error) {
          appStore.showStatus("Hide failed: " + error);
        }
      });
      if (disposed) { unlistenClose?.(); unlistenQuit?.(); }
    })();
    const handleFocus = async () => { await persistenceRegistry.checkActive(appStore.currentView); if (appStore.currentView !== "todo") await workspaceStore.refresh(); };
    window.addEventListener("focus", handleFocus);
    return () => { disposed = true; unlistenClose?.(); unlistenQuit?.(); unlistenResized?.(); window.removeEventListener("focus", handleFocus); window.removeEventListener("resize", handleResize); };
  });

  async function closeApp() {
    if (!(await persistenceRegistry.flushAll())) return appStore.showStatus("Resolve file conflicts before closing");
    try {
      const appWindow = getCurrentWindow();
      await appWindow.hide();
    } catch (error) {
      appStore.showStatus("Hide failed: " + error);
    }
  }

  async function minimizeApp() {
    try {
      const appWindow = getCurrentWindow();
      if (appStore.layerMode === "desktop") await appWindow.hide();
      else await appWindow.minimize();
    } catch (error) {
      appStore.showStatus("Minimize failed: " + error);
    }
  }

  async function toggleMaximizeApp() {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.toggleMaximize();
    } catch (error) {
      appStore.showStatus("Maximize failed: " + error);
    }
  }

  async function reloadTodo() {
    todoUiState.clearSelection();
    await todoStore.loadFile();
  }

  function toggleSettings() {
    todoUiState.clearSelection();
    editingSettings = !editingSettings;
  }

  let headerStatusMessage = $derived(
    appStore.statusMessage
      || (appStore.currentView === "todo" && todoUiState.hasSelection
        ? `${todoUiState.selectedTodoIds.length} selected`
        : "")
  );
</script>

<main class="app-container" class:desktop-mode={appStore.layerMode === "desktop"} class:maximized={isMaximized}>
  <AppHeader title={workspaceStore.needsFirstSetup ? "Workspace setup" : appStore.currentView === "todo" ? "Todo" : appStore.currentView === "week" ? "Weekly planner" : "Daily log"} dragEnabled={appStore.dragEnabled} layerMode={appStore.layerMode} statusMessage={headerStatusMessage} {showModeMenu} {isMaximized} onToggleSidebar={() => workspaceStore.sidebarOpen = !workspaceStore.sidebarOpen} onToggleModeMenu={() => showModeMenu = !showModeMenu} onDismissModeMenu={() => showModeMenu = false} onSelectMode={(mode) => { appStore.changeLayerMode(mode); showModeMenu = false; }} onToggleSettings={toggleSettings} onShrinkApp={minimizeApp} onMaximizeApp={toggleMaximizeApp} onCloseApp={closeApp} />
  {#if workspaceStore.needsFirstSetup}
    <section class="setup-screen">
      <div>
        <span>Workspace</span>
        <h1>Select a workspace folder</h1>
        <p>The app will use this folder for todo.md and weekly log folders.</p>
        <button onclick={() => workspaceStore.chooseRoot()}>Select workspace</button>
      </div>
    </section>
  {:else}
    <div class="workspace-shell">
      <AppSidebar open={workspaceStore.sidebarOpen} {selectedPath} onSelectWeek={selectWeek} onSelectDay={selectDay} />
      <section class="main-workspace">
        {#if editingSettings}
          <SettingsPanel dragEnabled={appStore.dragEnabled} autostartEnabled={appStore.autostartEnabled} onToggleDrag={() => appStore.toggleDrag()} onToggleAutostart={() => appStore.toggleAutostart()} />
        {:else}
          <MainTabs currentView={appStore.currentView} onSelect={(view) => view === "todo" ? appStore.currentView = "todo" : openCurrent(view)} />
          {#if appStore.currentView === "todo" && todoStore.conflict}<ConflictBanner onReloadExternal={() => todoStore.resolveConflict("reload")} onKeepLocal={() => todoStore.resolveConflict("keep-local")} />{/if}
          <div class="panel-scroll" class:todo-scroll={appStore.currentView === "todo"}>{#if appStore.currentView === "todo"}<TodoPanel />{:else if appStore.currentView === "week"}<WeekPanel />{:else}<DailyPanel />{/if}</div>
          {#if appStore.currentView === "todo" && !todoStore.fileMissing}<TodoToolbar undoStackLength={todoStore.undoStack.length} redoStackLength={todoStore.redoStack.length} onAddTodo={() => todoStore.addTodo(-1, 0)} onUndo={() => todoStore.undo()} onRedo={() => todoStore.redo()} onReload={reloadTodo} onClearCompleted={() => todoStore.clearCompleted()} />{/if}
        {/if}
      </section>
    </div>
  {/if}
</main>

<style>
  .setup-screen { display: grid; place-items: center; flex: 1; min-height: 0; padding: 24px; box-sizing: border-box; }
  .setup-screen > div { display: grid; justify-items: center; gap: 10px; width: min(420px, 100%); text-align: center; }
  .setup-screen span { color: var(--accent); font-size: var(--text-xs); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
  .setup-screen h1 { margin: 0; font-size: 22px; }
  .setup-screen p { margin: 0 0 8px; color: var(--text-muted); font-size: var(--text-sm); }
  .setup-screen button { width: fit-content; min-height: 34px; padding: 0 14px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-color); cursor: pointer; }
  .setup-screen button:hover { border-color: var(--border-strong); background: var(--surface-hover); }
  .workspace-shell { display: flex; flex: 1; min-height: 0; overflow: hidden; }
  .main-workspace { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; background: var(--bg-panel); }
  .panel-scroll { flex: 1; min-height: 0; overflow: auto; scroll-behavior: smooth; scrollbar-width: none; }
  .panel-scroll::-webkit-scrollbar { width: 0; height: 0; display: none; }
  .panel-scroll.todo-scroll { scrollbar-width: thin; scrollbar-color: #333333 transparent; }
  .panel-scroll.todo-scroll::-webkit-scrollbar { width: 6px; height: 6px; display: block; }
  .panel-scroll.todo-scroll::-webkit-scrollbar-track { background: transparent; }
  .panel-scroll.todo-scroll::-webkit-scrollbar-thumb { background: #333333; border-radius: 3px; }
  .panel-scroll.todo-scroll::-webkit-scrollbar-thumb:hover { background: #444444; }
</style>
