<script>
  // @ts-nocheck
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
  import { openPath } from "@tauri-apps/plugin-opener";
  import { confirm } from "@tauri-apps/plugin-dialog";
  import { appStore } from "./appStore.svelte.js";
  import { workspaceStore } from "./workspaceStore.svelte.js";
  import { subjectHistoryStore } from "./subjectHistoryStore.svelte.js";
  import { sessionHistoryStore } from "./sessionHistoryStore.svelte.js";
  import { persistenceRegistry } from "./persistenceRegistry.js";
  import { suppressPrintShortcut } from "./applicationShortcuts.js";
  import { NavigationHistory } from "./navigationHistory.svelte.js";
  import { todoStore } from "$lib/features/todo/todoStore.svelte.js";
  import { todoUiState } from "$lib/features/todo/todoUiState.svelte.js";
  import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
  import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
  import { formatDate, getWeekDescriptor, pathBelongsToWeek } from "$lib/shared/services/logWorkspaceService.js";
  import AppHeader from "./AppHeader.svelte";
  import SettingsDialog from "./SettingsDialog.svelte";
  import HelpDialog from "./HelpDialog.svelte";
  import StatusToast from "./StatusToast.svelte";
  import WeekFilesDialog from "./WeekFilesDialog.svelte";
  import AppSidebar from "./AppSidebar.svelte";
  import TodoPanel from "$lib/features/todo/components/TodoPanel.svelte";
  import TodoToolbar from "$lib/features/todo/components/TodoToolbar.svelte";
  import DailyPanel from "$lib/features/daily/components/DailyPanel.svelte";
  import WeekPanel from "$lib/features/weekly/components/WeekPanel.svelte";
  import ConflictBanner from "$lib/shared/components/ConflictBanner.svelte";

  let showSettings = $state(false);
  let showHelp = $state(false);
  let showWeekFilesDialog = $state(false);
  let showModeMenu = $state(false);
  let selectedPath = $state("");
  let isMaximized = $state(false);
  const navigationHistory = new NavigationHistory({ view: "todo", path: "" });

  const viewSizeConstraints = {
    todo: { width: 480, height: 360 },
    day: { width: 900, height: 620 },
    week: { width: 1280, height: 700 }
  };

  function descriptorFor(week) {
    const date = week.days[0]?.date ? new Date(`${week.days[0].date}T12:00:00`) : new Date();
    return getWeekDescriptor(date);
  }

  async function selectWeek(week, { record = true } = {}) {
    if (!week.indexPath) return false;
    todoUiState.clearSelection();
    if (!(await weekStore.loadPath(week.indexPath, descriptorFor(week), week.days))) return false;
    selectedPath = week.indexPath;
    appStore.currentView = "week";
    if (record) navigationHistory.visit({ view: "week", path: week.indexPath });
    return true;
  }

  async function selectDay(day, week, { record = true } = {}) {
    todoUiState.clearSelection();
    if (week.indexPath && weekStore.path !== week.indexPath) {
      if (!(await weekStore.loadPath(week.indexPath, descriptorFor(week), week.days))) return false;
    }
    if (!(await dailyStore.loadPath(day.path, day.date))) return false;
    selectedPath = day.path;
    appStore.currentView = "day";
    if (record) navigationHistory.visit({ view: "day", path: day.path });
    return true;
  }

  function selectTodo({ record = true } = {}) {
    todoUiState.clearSelection();
    selectedPath = "";
    appStore.currentView = "todo";
    if (record) navigationHistory.visit({ view: "todo", path: "" });
    return true;
  }

  async function openCurrent(kind, { record = true } = {}) {
    if (kind !== "todo") todoUiState.clearSelection();
    const today = formatDate(new Date());
    const weekName = getWeekDescriptor(new Date()).folderName;
    const week = workspaceStore.weeks.find((item) => item.name === weekName);
    if (kind === "day") {
      const day = week?.days.find((item) => item.date === today);
      if (day) return await selectDay(day, week, { record });
    } else if (kind === "week" && week?.indexPath) {
      return await selectWeek(week, { record });
    } else if (kind === "todo") {
      return selectTodo({ record });
    }
    appStore.showStatus(kind === "day" ? "Today log not found" : "Current week not found");
    return false;
  }

  async function restoreNavigationDestination(destination) {
    if (!destination) return false;
    if (destination.view === "todo") return selectTodo({ record: false });
    for (const week of workspaceStore.weeks) {
      if (destination.view === "week" && week.indexPath === destination.path) {
        return selectWeek(week, { record: false });
      }
      if (destination.view === "day") {
        const day = week.days.find((item) => item.path === destination.path);
        if (day) return selectDay(day, week, { record: false });
      }
    }
    appStore.showStatus("Navigation target is no longer available");
    return false;
  }

  async function moveThroughHistory(direction) {
    const destination = direction === "back" ? navigationHistory.back() : navigationHistory.forward();
    if (!destination) return;
    if (await restoreNavigationDestination(destination)) return;
    if (direction === "back") navigationHistory.forward();
    else navigationHistory.back();
  }

  function unloadWeekDocuments(week) {
    if (pathBelongsToWeek(weekStore.path, week.path)) weekStore.unload();
    if (pathBelongsToWeek(dailyStore.path, week.path)) dailyStore.unload();
  }

  async function reloadActiveWeekDestination(week, activeView, activePath) {
    const refreshedWeek = workspaceStore.weeks.find((item) => item.name === week.name);
    if (!refreshedWeek) return false;
    if (activeView === "week" && refreshedWeek.indexPath === activePath) {
      return await selectWeek(refreshedWeek, { record: false });
    }
    if (activeView === "day") {
      const day = refreshedWeek.days.find((item) => item.path === activePath);
      if (day) return await selectDay(day, refreshedWeek, { record: false });
    }
    return false;
  }

  async function repairWeek(week) {
    const activeView = appStore.currentView;
    const activePath = selectedPath;
    if (!(await workspaceStore.repairWeek(week))) return false;
    if (!pathBelongsToWeek(activePath, week.path)) return true;
    return await reloadActiveWeekDestination(week, activeView, activePath);
  }

  async function convertWeekToPersonal(week) {
    if (!(await persistenceRegistry.flushAll())) {
      appStore.showStatus("Resolve file conflicts before converting the week");
      return false;
    }
    const activeView = appStore.currentView;
    const activePath = selectedPath;
    if (!(await workspaceStore.convertWeekToPersonal(week))) return false;
    unloadWeekDocuments(week);
    if (!pathBelongsToWeek(activePath, week.path)) return true;
    return await reloadActiveWeekDestination(week, activeView, activePath);
  }

  async function deleteWeek(week) {
    let approved;
    try {
      approved = await confirm(
        `Move ${week.name} and all of its log files to the Recycle Bin?`,
        { title: "Delete week", kind: "warning" }
      );
    } catch (error) {
      appStore.showStatus("Delete confirmation failed: " + error);
      return false;
    }
    if (!approved) return false;
    if (!(await persistenceRegistry.flushAll())) {
      appStore.showStatus("Resolve file conflicts before deleting the week");
      return false;
    }
    const wasActive = pathBelongsToWeek(selectedPath, week.path);
    if (!(await workspaceStore.recycleWeek(week))) return false;
    unloadWeekDocuments(week);
    navigationHistory.removePathsUnder(week.path);
    if (wasActive) selectTodo();
    return true;
  }

  function handleShellKeydown(event) {
    if (suppressPrintShortcut(event)) return;
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (document.querySelector('[role="dialog"], [role="menu"]')) return;
    event.preventDefault();
    void moveThroughHistory(event.key === "ArrowLeft" ? "back" : "forward");
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

  $effect(() => {
    if (!appStore.devMode) return;

    const handleKeyDown = async (e) => {
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && (e.key === "i" || e.key === "I"))) {
        e.preventDefault();
        try {
          await invoke("toggle_devtools");
        } catch (error) {
          appStore.showStatus("Failed to toggle devtools: " + error);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
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
    const handleContextMenu = (event) => {
      if (event.defaultPrevented || appStore.devMode) return;
      event.preventDefault();
    };
    window.addEventListener("contextmenu", handleContextMenu);
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
    return () => { disposed = true; unlistenClose?.(); unlistenQuit?.(); unlistenResized?.(); window.removeEventListener("focus", handleFocus); window.removeEventListener("resize", handleResize); window.removeEventListener("contextmenu", handleContextMenu); };
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
    showHelp = false;
    showSettings = !showSettings;
  }

  async function openActiveMarkdown() {
    const targetPath = appStore.currentView === "todo"
      ? (todoStore.loadedPath || appStore.filePath)
      : appStore.currentView === "week"
        ? weekStore.path
        : dailyStore.path;
    if (!targetPath) return appStore.showStatus("No active file");
    try {
      await openPath(targetPath);
    } catch (error) {
      appStore.showStatus("Failed to open: " + error);
    }
  }
</script>

<svelte:window onkeydown={handleShellKeydown} />

<main class="app-container" class:desktop-mode={appStore.layerMode === "desktop"} class:maximized={isMaximized}>
  <AppHeader
    title={workspaceStore.needsFirstSetup ? "Workspace setup" : appStore.currentView === "todo" ? "Todo" : appStore.currentView === "week" ? "Weekly planner" : "Daily log"}
    currentView={appStore.currentView}
    sidebarOpen={workspaceStore.sidebarOpen}
    dragEnabled={appStore.dragEnabled}
    layerMode={appStore.layerMode}
    {showModeMenu}
    {isMaximized}
    canGoBack={navigationHistory.canGoBack}
    canGoForward={navigationHistory.canGoForward}
    onToggleSidebar={() => workspaceStore.sidebarOpen = !workspaceStore.sidebarOpen}
    onBack={() => moveThroughHistory("back")}
    onForward={() => moveThroughHistory("forward")}
    onToggleModeMenu={() => showModeMenu = !showModeMenu}
    onDismissModeMenu={() => showModeMenu = false}
    onSelectMode={(mode) => { appStore.changeLayerMode(mode); showModeMenu = false; }}
    onToggleSettings={toggleSettings}
    onOpenView={(view) => openCurrent(view)}
    onOpenActiveFile={openActiveMarkdown}
    onCreateCurrentWeek={() => workspaceStore.createCurrentWeekFiles()}
    onCreateNextWeek={() => workspaceStore.createNextWeekFiles()}
    onChooseWeeks={() => showWeekFilesDialog = true}
    onOpenHelp={() => { showSettings = false; showHelp = true; }}
    onShrinkApp={minimizeApp}
    onMaximizeApp={toggleMaximizeApp}
    onCloseApp={closeApp}
  />
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
      <AppSidebar
        open={workspaceStore.sidebarOpen}
        {selectedPath}
        onSelectWeek={selectWeek}
        onSelectDay={selectDay}
        onRepairWeek={repairWeek}
        onConvertWeek={convertWeekToPersonal}
        onDeleteWeek={deleteWeek}
        keyboardNavigationEnabled={!showSettings && !showHelp}
      />
      <section class="main-workspace">
        {#if appStore.currentView === "todo" && todoStore.conflict}<ConflictBanner onReloadExternal={() => todoStore.resolveConflict("reload")} onKeepLocal={() => todoStore.resolveConflict("keep-local")} />{/if}
        <div class="panel-scroll" class:todo-scroll={appStore.currentView === "todo"}>{#if appStore.currentView === "todo"}<TodoPanel />{:else if appStore.currentView === "week"}<WeekPanel />{:else}<DailyPanel />{/if}</div>
        {#if appStore.currentView === "todo" && !todoStore.fileMissing}<TodoToolbar selectedCount={todoUiState.selectedTodoIds.length} undoStackLength={todoStore.undoStack.length} redoStackLength={todoStore.redoStack.length} onAddTodo={() => todoStore.addTodo(-1, 0)} onUndo={() => todoStore.undo()} onRedo={() => todoStore.redo()} onReload={reloadTodo} onClearCompleted={() => todoStore.clearCompleted()} />{/if}
      </section>
    </div>
  {/if}
  {#if showSettings}
    <SettingsDialog dragEnabled={appStore.dragEnabled} autostartEnabled={appStore.autostartEnabled} onToggleDrag={() => appStore.toggleDrag()} onToggleAutostart={() => appStore.toggleAutostart()} onClose={() => showSettings = false} />
  {/if}
  {#if showHelp}<HelpDialog onClose={() => showHelp = false} />{/if}
  {#if showWeekFilesDialog}
    <WeekFilesDialog onClose={() => showWeekFilesDialog = false} onSubmit={(year, week, count) => workspaceStore.createSelectedWeekFiles(year, week, count)} />
  {/if}
  <StatusToast message={appStore.statusMessage} />
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
