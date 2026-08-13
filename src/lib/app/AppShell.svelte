<script>
  // @ts-nocheck
  import { onMount, tick } from "svelte";
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
  import { scratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.js";
  import { formatDate, getWeekDescriptor, pathBelongsToWeek, scratchpadPathForWorkspace } from "$lib/shared/services/logWorkspaceService.js";
  import AppHeader from "./AppHeader.svelte";
  import SettingsDialog from "./SettingsDialog.svelte";
  import HelpDialog from "./HelpDialog.svelte";
  import StatusToast from "./StatusToast.svelte";
  import WeekFilesDialog from "./WeekFilesDialog.svelte";
  import AppSidebar from "./AppSidebar.svelte";
  import WorkspacePane from "./WorkspacePane.svelte";
  import { createWorkspaceSession } from "./workspaceSession.svelte.js";

  let showSettings = $state(false);
  let showHelp = $state(false);
  let showWeekFilesDialog = $state(false);
  let showModeMenu = $state(false);
  let selectedPath = $state("");
  let isMaximized = $state(false);
  let hasWorkspace = $derived(workspaceStore.hasWorkspacePath);
  let leftPane = $state();
  let rightPane = $state();
  let splitView = $state(false);
  let splitRatio = $state(0.5);
  let focusedPane = $state("left");
  const leftSession = { todoStore, dailyStore, weekStore, scratchpadStore };
  const rightSession = createWorkspaceSession();
  const navigationHistory = new NavigationHistory({ view: "todo", path: "" });

  const viewSizeConstraints = {
    todo: { width: 480, height: 360 },
    scratchpad: { width: 480, height: 360 },
    day: { width: 900, height: 620 },
    week: { width: 1280, height: 700 }
  };
  const viewTitles = {
    todo: "Todo",
    scratchpad: "Scratchpad",
    week: "Weekly planner",
    day: "Daily log"
  };

  function dayTab(day) {
    return { id: `day:${day.path}`, view: "day", title: day.date, path: day.path, date: day.date };
  }

  function weekTab(week) {
    return { id: `week:${week.indexPath}`, view: "week", title: week.name, path: week.indexPath };
  }

  function scratchpadTab() {
    const path = scratchpadPathForWorkspace(appStore.logsRootPath);
    return { id: "scratchpad", view: "scratchpad", title: "Scratchpad", path };
  }

  function activePane() { return focusedPane === "right" && splitView ? rightPane : leftPane; }

  async function focusExistingTab(tab) {
    if (rightPane?.hasTab(tab.id)) {
      focusedPane = "right";
      return await rightPane.openTab(tab);
    }
    if (leftPane?.hasTab(tab.id)) {
      focusedPane = "left";
      return await leftPane.openTab(tab);
    }
    return false;
  }

  function updateFocusedView({ view, path }) {
    selectedPath = path;
    appStore.currentView = view;
  }

  async function openInSplit(tab) {
    if (rightPane?.hasTab(tab.id)) {
      focusedPane = "right";
      await rightPane?.openTab(tab);
      return;
    }
    const tabIsOnlyLeftTab = leftPane?.hasTab(tab.id)
      && leftPane.activeTabId?.() === tab.id
      && leftPane.tabCount?.() === 1;
    if (tabIsOnlyLeftTab) {
      appStore.showStatus("Choose another tab to open beside the current one");
      return;
    }
    if (!splitView) splitView = true;
    await tick();
    if (leftPane?.hasTab(tab.id)) leftPane.takeTab(tab.id);
    focusedPane = "right";
    await rightPane?.openTab(tab);
  }

  function openTodoInSplit() { return openInSplit({ id: "todo", view: "todo", title: "Todo", path: "" }); }
  function openScratchpadInSplit() { return openInSplit(scratchpadTab()); }
  function openWeekInSplit(week) { return openInSplit(weekTab(week)); }
  function openDayInSplit(day) { return openInSplit(dayTab(day)); }

  async function collapseSplit() {
    const tabs = rightPane?.takeAllTabs?.() || [];
    for (const tab of tabs) await leftPane?.openTab(tab, { background: true });
    splitView = false;
    focusedPane = "left";
    await tick();
    await leftPane?.focusActive?.();
  }

  function beginSplitResize(event) {
    event.preventDefault();
    const workspace = event.currentTarget.parentElement;
    const move = (moveEvent) => {
      const rect = workspace.getBoundingClientRect();
      splitRatio = Math.min(0.8, Math.max(0.2, (moveEvent.clientX - rect.left) / rect.width));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  async function openDayInBackground(day) {
    if (await focusExistingTab(dayTab(day))) return true;
    return await activePane()?.openDay(day, { background: true });
  }

  async function openTodoInBackground() {
    if (await focusExistingTab({ id: "todo", view: "todo", title: "Todo", path: "" })) return true;
    return activePane()?.openTodo({ background: true });
  }

  async function openScratchpadInBackground() {
    if (await focusExistingTab(scratchpadTab())) return true;
    return activePane()?.openScratchpad({ background: true });
  }

  async function openWeekInBackground(week) {
    if (await focusExistingTab(weekTab(week))) return true;
    return activePane()?.openWeek(week, { background: true });
  }

  async function selectWeek(week, { record = true } = {}) {
    if (!week.indexPath) return false;
    if (await focusExistingTab(weekTab(week))) return true;
    return await activePane()?.openWeek(week);
  }

  async function selectDay(day, week, { record = true } = {}) {
    if (await focusExistingTab(dayTab(day))) return true;
    return await activePane()?.openDay(day);
  }

  async function selectTodo({ record = true } = {}) {
    if (await focusExistingTab({ id: "todo", view: "todo", title: "Todo", path: "" })) return true;
    return await activePane()?.openTodo();
  }

  async function selectScratchpad({ record = true } = {}) {
    if (await focusExistingTab(scratchpadTab())) return true;
    return await activePane()?.openScratchpad();
  }

  async function openCurrent(kind, { record = true } = {}) {
    if (kind !== "todo") todoUiState.clearSelection();
    if (kind === "scratchpad") return await selectScratchpad({ record });
    const today = formatDate(new Date());
    const weekName = getWeekDescriptor(new Date()).folderName;
    const week = workspaceStore.weeks.find((item) => item.name === weekName);
    if (kind === "day") {
      const day = week?.days.find((item) => item.date === today);
      if (day) return await selectDay(day, week, { record });
    } else if (kind === "week" && week?.indexPath) {
      return await selectWeek(week, { record });
    } else if (kind === "todo") {
      return await selectTodo({ record });
    }
    appStore.showStatus(kind === "day" ? "Today log not found" : "Current week not found");
    return false;
  }

  async function restoreNavigationDestination(destination) {
    if (!destination) return false;
    if (destination.view === "todo") return await selectTodo({ record: false });
    if (destination.view === "scratchpad") return await selectScratchpad({ record: false });
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

  async function unloadWeekDocuments(week) {
    await leftPane?.closeTabsUnder?.(week.path);
    await rightPane?.closeTabsUnder?.(week.path);
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
    await unloadWeekDocuments(week);
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
    await unloadWeekDocuments(week);
    navigationHistory.removePathsUnder(week.path);
    if (wasActive) await selectTodo();
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
    const sidebarWidth = (workspaceStore.sidebarOpen && hasWorkspace) ? 180 : 0;
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
        try {
          unlistenResized = await appWindow.onResized(handleResize);
          if (disposed) unlistenResized();
        } catch {}
        try {
          unlistenQuit = await listen("request-quit", async () => {
            if (await persistenceRegistry.flushAll()) await invoke("exit_app");
            else appStore.showStatus("Resolve file conflicts before quitting");
          });
        } catch {}
        await appStore.loadConfig();
        await workspaceStore.refresh();
        await subjectHistoryStore.load(appStore.logsRootPath);
        await sessionHistoryStore.load(appStore.logsRootPath);
        if (appStore.filePath) await todoStore.loadFile();
        try {
          unlistenClose = await appWindow.onCloseRequested(async (event) => {
            event.preventDefault();
            if (!(await persistenceRegistry.flushAll())) return appStore.showStatus("Resolve file conflicts before closing");
            try {
              await appWindow.hide();
            } catch (error) {
              appStore.showStatus("Hide failed: " + error);
            }
          });
        } catch {}
      } catch (error) {
        appStore.showStatus("Initialization error: " + error);
      }
      if (disposed) { unlistenClose?.(); unlistenQuit?.(); }
    })();
    const handleFocus = async () => {
      await persistenceRegistry.checkActive(appStore.currentView);
      if (["week", "day"].includes(appStore.currentView)) await workspaceStore.refresh();
    };
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
    const targetPath = activePane()?.activeFilePath?.();
    if (!targetPath) return appStore.showStatus("No active file");
    try {
      await openPath(targetPath);
    } catch (error) {
      appStore.showStatus("Failed to open: " + error);
    }
  }

  async function selectWorkspaceRoot() {
    try {
      const ok = await workspaceStore.chooseRoot();
      if (!ok && !workspaceStore.hasWorkspacePath) {
        appStore.showStatus("No workspace folder selected");
      }
    } catch (error) {
      appStore.showStatus("Workspace selection failed: " + error);
    }
  }
</script>

<svelte:window onkeydown={handleShellKeydown} />

<main class="app-container" class:desktop-mode={appStore.layerMode === "desktop"} class:maximized={isMaximized}>
  <AppHeader
    title={!hasWorkspace ? "Workspace setup" : (viewTitles[appStore.currentView] || "Tracker")}
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
  {#if !hasWorkspace}
    <section class="setup-screen">
      <div>
        <span>Workspace</span>
        <h1>Select a workspace folder</h1>
        <p>The app will use this folder for todo.md and weekly log folders.</p>
        <button onclick={selectWorkspaceRoot}>Select workspace</button>
      </div>
    </section>
  {:else}
    <div class="workspace-shell">
      <AppSidebar
        open={workspaceStore.sidebarOpen}
        currentView={appStore.currentView}
        {selectedPath}
        onSelectScratchpad={() => selectScratchpad()}
        onSelectTodo={() => selectTodo()}
        onSelectWeek={selectWeek}
        onSelectDay={selectDay}
        onOpenDayInBackground={openDayInBackground}
        onOpenWeekInBackground={openWeekInBackground}
        onMiddleClickTodo={openTodoInBackground}
        onMiddleClickScratchpad={openScratchpadInBackground}
        onOpenTodoInSplit={openTodoInSplit}
        onOpenScratchpadInSplit={openScratchpadInSplit}
        onOpenWeekInSplit={openWeekInSplit}
        onOpenDayInSplit={openDayInSplit}
        onRepairWeek={repairWeek}
        onConvertWeek={convertWeekToPersonal}
        onDeleteWeek={deleteWeek}
        keyboardNavigationEnabled={!showSettings && !showHelp}
      />
      <section class="main-workspace">
        <div class="pane-wrap" style:flex-basis={splitView ? `${splitRatio * 100}%` : "100%"}><WorkspacePane bind:this={leftPane} session={leftSession} initialTabs={[{ id: "todo", view: "todo", title: "Todo", path: "" }]} onFocused={(detail) => { focusedPane = "left"; updateFocusedView(detail); }} onRequestSplit={openInSplit} onEmpty={() => { if (splitView) void collapseSplit(); }} /></div>
        {#if splitView}
          <div class="split-divider" role="separator" aria-orientation="vertical" aria-label="Resize split view" onpointerdown={beginSplitResize}></div>
          <div class="pane-wrap" style:flex-basis={`${(1 - splitRatio) * 100}%`}><WorkspacePane bind:this={rightPane} session={rightSession} onFocused={(detail) => { focusedPane = "right"; updateFocusedView(detail); }} onEmpty={collapseSplit} onSeparate={collapseSplit} /></div>
        {/if}
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
  .main-workspace { display: flex; flex: 1; min-width: 0; min-height: 0; background: var(--bg-panel); }
  .pane-wrap { display: flex; min-width: 0; min-height: 0; }
  .split-divider { position: relative; z-index: 1; flex: 0 0 0; cursor: col-resize; touch-action: none; }
  .split-divider::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 1px; background: var(--border-color); transition: background .12s ease, width .12s ease; }
  .split-divider::after { content: ""; position: absolute; inset: 0 -5px; }
  .split-divider:hover::before, .split-divider:active::before { width: 2px; background: #587b61; }
</style>
