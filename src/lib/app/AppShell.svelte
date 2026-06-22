<script>
  // @ts-nocheck
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { appStore } from "./appStore.svelte.js";
  import { workspaceStore } from "./workspaceStore.svelte.js";
  import { persistenceRegistry } from "./persistenceRegistry.js";
  import { todoStore } from "$lib/features/tasks/todoStore.svelte.js";
  import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
  import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
  import { formatDate, getWeekDescriptor } from "$lib/shared/services/logWorkspaceService.js";
  import AppHeader from "./AppHeader.svelte";
  import SettingsPanel from "./SettingsPanel.svelte";
  import MainTabs from "./MainTabs.svelte";
  import AppSidebar from "./AppSidebar.svelte";
  import TasksPanel from "$lib/features/tasks/components/TasksPanel.svelte";
  import TodoToolbar from "$lib/features/tasks/components/TodoToolbar.svelte";
  import DailyPanel from "$lib/features/daily/components/DailyPanel.svelte";
  import WeekPanel from "$lib/features/weekly/components/WeekPanel.svelte";
  import ConflictBanner from "$lib/shared/components/ConflictBanner.svelte";

  let editingSettings = $state(false);
  let todoPathInput = $state("");
  let showModeMenu = $state(false);
  let selectedPath = $state("");
  let closingAfterFlush = false;

  function descriptorFor(week) {
    const date = week.days[0]?.date ? new Date(`${week.days[0].date}T12:00:00`) : new Date();
    return getWeekDescriptor(date);
  }

  async function selectWeek(week) {
    if (!week.indexPath) return;
    selectedPath = week.indexPath;
    appStore.currentView = "week";
    await weekStore.loadPath(week.indexPath, descriptorFor(week), week.days);
  }

  async function selectDay(day, week) {
    selectedPath = day.path;
    if (week.indexPath && weekStore.path !== week.indexPath) {
      await weekStore.loadPath(week.indexPath, descriptorFor(week), week.days);
    }
    appStore.currentView = "day";
    await dailyStore.loadPath(day.path, day.date);
  }

  async function openCurrent(kind) {
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

  onMount(() => {
    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlistenClose;
    let unlistenQuit;
    (async () => {
      unlistenQuit = await listen("request-quit", async () => {
        if (await persistenceRegistry.flushAll()) await invoke("exit_app");
        else appStore.showStatus("Resolve file conflicts before quitting");
      });
      await appStore.loadConfig();
      todoPathInput = appStore.filePath;
      await todoStore.loadFile();
      await workspaceStore.refresh();
      unlistenClose = await appWindow.onCloseRequested(async (event) => {
        if (closingAfterFlush) return;
        event.preventDefault();
        if (!(await persistenceRegistry.flushAll())) return appStore.showStatus("Resolve file conflicts before closing");
        closingAfterFlush = true;
        try {
          await invoke("exit_app");
        } catch (error) {
          appStore.showStatus("Close failed: " + error);
        }
      });
      if (disposed) { unlistenClose?.(); unlistenQuit?.(); }
    })();
    const handleFocus = async () => { await persistenceRegistry.checkActive(appStore.currentView); if (appStore.currentView !== "tasks") await workspaceStore.refresh(); };
    window.addEventListener("focus", handleFocus);
    return () => { disposed = true; unlistenClose?.(); unlistenQuit?.(); window.removeEventListener("focus", handleFocus); };
  });

  async function saveTodoPath() {
    const value = todoPathInput.trim();
    if (!value) return;
    if (await todoStore.loadFile({ path: value })) { editingSettings = false; await appStore.saveConfig(); }
  }

  async function closeApp() {
    if (!(await persistenceRegistry.flushAll())) return appStore.showStatus("Resolve file conflicts before closing");
    try {
      await invoke("exit_app");
    } catch (error) {
      appStore.showStatus("Close failed: " + error);
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
</script>

<main class="app-container" class:desktop-mode={appStore.layerMode === "desktop"}>
  <AppHeader title={appStore.currentView === "tasks" ? "Tasks" : appStore.currentView === "week" ? "Weekly planner" : "Daily log"} dragEnabled={appStore.dragEnabled} layerMode={appStore.layerMode} statusMessage={appStore.statusMessage} {showModeMenu} onToggleSidebar={() => workspaceStore.sidebarOpen = !workspaceStore.sidebarOpen} onToggleModeMenu={() => showModeMenu = !showModeMenu} onSelectMode={(mode) => { appStore.changeLayerMode(mode); showModeMenu = false; }} onToggleSettings={() => editingSettings = !editingSettings} onShrinkApp={minimizeApp} onCloseApp={closeApp} />
  <div class="workspace-shell">
    {#if workspaceStore.sidebarOpen}<div class="sidebar-wrap"><AppSidebar {selectedPath} onSelectWeek={selectWeek} onSelectDay={selectDay} /></div>{/if}
    <section class="main-workspace">
      {#if editingSettings}
        <SettingsPanel bind:pathInputVal={todoPathInput} logsRootPath={appStore.logsRootPath} dragEnabled={appStore.dragEnabled} autostartEnabled={appStore.autostartEnabled} onSave={saveTodoPath} onCancel={() => editingSettings = false} onToggleDrag={() => appStore.toggleDrag()} onToggleAutostart={() => appStore.toggleAutostart()} />
      {:else}
        <MainTabs currentView={appStore.currentView} onSelect={(view) => view === "tasks" ? appStore.currentView = "tasks" : openCurrent(view)} />
        {#if appStore.currentView === "tasks" && todoStore.conflict}<ConflictBanner onReloadExternal={() => todoStore.resolveConflict("reload")} onKeepLocal={() => todoStore.resolveConflict("keep-local")} />{/if}
        <div class="panel-scroll">{#if appStore.currentView === "tasks"}<TasksPanel />{:else if appStore.currentView === "week"}<WeekPanel />{:else}<DailyPanel />{/if}</div>
        {#if appStore.currentView === "tasks"}<TodoToolbar redoStackLength={todoStore.redoStack.length} onAddTask={() => todoStore.addTask(-1, 0)} onUndo={() => todoStore.undo()} onRedo={() => todoStore.redo()} onReload={() => todoStore.loadFile()} onClearCompleted={() => todoStore.clearCompleted()} />{/if}
      {/if}
    </section>
  </div>
</main>

<style>
  .workspace-shell { display: flex; flex: 1; min-height: 0; overflow: hidden; }
  .sidebar-wrap { flex: none; min-width: 210px; }
  .main-workspace { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; background: var(--bg-panel); }
  .panel-scroll { flex: 1; min-height: 0; overflow: auto; scroll-behavior: smooth; }
  @media (max-width: 720px) { .sidebar-wrap { position: absolute; inset: 32px auto 0 0; z-index: 40; height: calc(100% - 32px); box-shadow: 16px 0 36px rgba(0,0,0,.36); } }
</style>
