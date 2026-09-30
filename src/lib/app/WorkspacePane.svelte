<script>
  // @ts-nocheck
  import { createEventDispatcher, onDestroy } from "svelte";
  import { getWeekDescriptor, scratchpadPathForWorkspace } from "$lib/shared/services/logWorkspaceService.js";
  import { appStore } from "./appStore.svelte.js";
  import { workspaceStore } from "./workspaceStore.svelte.js";
  import { blockedSaveMessage } from "./persistenceRegistry.js";
  import { DocumentController, documentSucceeded } from "$lib/shared/persistence/documentController.js";
  import WorkspaceTabs from "./WorkspaceTabs.svelte";
  import TodoPanel from "$lib/features/todo/components/TodoPanel.svelte";
  import TodoToolbar from "$lib/features/todo/components/TodoToolbar.svelte";
  import DailyPanel from "$lib/features/daily/components/DailyPanel.svelte";
  import WeekPanel from "$lib/features/weekly/components/WeekPanel.svelte";
  import ScratchpadPanel from "$lib/features/scratchpad/components/ScratchpadPanel.svelte";
  import ConflictBanner from "$lib/shared/components/ConflictBanner.svelte";

  function succeeded(result) {
    return typeof result === "boolean" ? result : documentSucceeded(result);
  }

  let { session, initialTabs = [], focused = true, onFocused = () => {}, onRequestSplit = null, onMoveToLeft = null, onMoveToRight = null, onEmpty = null, onSeparate = null } = $props();
  let tabs = $state([]);
  let activeId = $state("");
  let initialized = $state(false);
  const dispatch = createEventDispatcher();
  let intentId = 0;
  let destroyed = false;

  $effect(() => {
    if (initialized) return;
    initialized = true;
    if (!initialTabs.length) return;
    tabs = [...initialTabs];
    activeId = initialTabs[0].id;
  });

  onDestroy(() => { destroyed = true; intentId += 1; });

  function beginIntent() {
    const id = ++intentId;
    return { id, isCurrent: () => !destroyed && intentId === id };
  }

  export function cancelPending() {
    intentId += 1;
  }

  function handlePaneFocus() {
    if (!activeTab) return;
    cancelPending();
    onFocused({ view: activeTab.view, path: activeTab.path });
  }

  function descriptorFor(week) {
    const date = week.days[0]?.date ? new Date(`${week.days[0].date}T12:00:00`) : new Date();
    return getWeekDescriptor(date);
  }

  function tabFor(view, data = {}) {
    if (view === "todo") return { id: "todo", view, title: "Todo", path: "" };
    if (view === "scratchpad") return { id: "scratchpad", view, title: "Scratchpad", path: scratchpadPathForWorkspace(appStore.logsRootPath) };
    if (view === "week") return { id: `week:${data.indexPath}`, view, title: data.name, path: data.indexPath };
    return { id: `day:${data.path}`, view: "day", title: data.date, path: data.path, date: data.date };
  }

  function pathForTab(tab) {
    if (!tab) return "";
    return tab.view === "todo" ? session.todoStore.loadedPath || appStore.filePath
      : tab.view === "scratchpad" ? tab.path
      : tab.path;
  }

  function targetPathForTab(tab) {
    return tab?.view === "todo" ? appStore.filePath : tab?.path || "";
  }

  function hasConflictForTab(tab) {
    const persistence = storeForTab(tab)?.persistence;
    const state = typeof persistence?.state === "function" ? persistence.state() : persistence?.state;
    return Boolean(state?.conflict && persistence?.path === targetPathForTab(tab));
  }

  async function load(tab, intent) {
    if (!tab || !intent.isCurrent()) return false;
    let result;
    if (tab.view === "todo") {
      result = await session.todoStore.loadFile({ path: targetPathForTab(tab), isCurrent: intent.isCurrent });
    } else if (tab.view === "scratchpad") {
      const store = session.scratchpadStore;
      result = await store.loadPath(tab.path, { reload: store.persistence?.path !== tab.path, isCurrent: intent.isCurrent });
    } else if (tab.view === "week") {
      const week = workspaceStore.weeks.find((item) => item.indexPath === tab.path);
      if (!week) return false;
      result = await session.weekStore.loadPath(tab.path, descriptorFor(week), week.days, { isCurrent: intent.isCurrent });
    } else if (tab.view === "day") {
      result = await session.dailyStore.loadPath(tab.path, tab.date, { isCurrent: intent.isCurrent });
    }
    return intent.isCurrent() && (succeeded(result) || hasConflictForTab(tab));
  }

  function focus(tab, intent) {
    if (!tab || !intent.isCurrent()) return false;
    activeId = tab.id;
    const detail = { view: tab.view, path: tab.path };
    onFocused(detail);
    dispatch("focus", detail);
    return true;
  }

  async function activate(tab, intent = beginIntent()) {
    if (!(await load(tab, intent)) || !intent.isCurrent()) return false;
    return focus(tab, intent);
  }

  async function open(tab, { background = false } = {}) {
    const existing = tabs.find((item) => item.id === tab.id);
    if (background) {
      if (!existing) tabs = [...tabs, tab];
      return true;
    }
    const intent = beginIntent();
    if (existing) return await activate(existing, intent);
    if (!(await load(tab, intent)) || !intent.isCurrent()) return false;
    tabs = [...tabs, tab];
    return focus(tab, intent);
  }

  export async function openTodo(options) { return open(tabFor("todo"), options); }
  export async function openScratchpad(options) { return open(tabFor("scratchpad"), options); }
  export async function openWeek(week, options) { return open(tabFor("week", week), options); }
  export async function openDay(day, options) { return open(tabFor("day", day), options); }
  export async function openTab(tab, options) { return open(tab, options); }

  export async function replaceActiveTab(tab) {
    const intent = beginIntent();
    if (tab.id === activeId) return await activate(tab, intent);
    const previousTab = activeTab;
    if (previousTab && !(await flushTab(previousTab, intent.isCurrent))) {
      if (intent.isCurrent()) appStore.showStatus(blockedSaveMessage("changing the tab", [storeForTab(previousTab)]));
      return false;
    }
    if (!intent.isCurrent() || !(await load(tab, intent)) || !intent.isCurrent()) return false;
    tabs = previousTab ? tabs.map((item) => item.id === previousTab.id ? tab : item) : [tab];
    return focus(tab, intent);
  }

  export function hasTab(id) { return tabs.some((tab) => tab.id === id); }
  export function tabCount() { return tabs.length; }
  export function tabsSnapshot() { return [...tabs]; }
  export function activeTabId() { return activeId; }
  export function activeFilePath() {
    if (!activeTab) return "";
    return session[`${activeTab.view === "day" ? "daily" : activeTab.view}Store`]?.persistence?.path || pathForTab(activeTab);
  }
  export async function focusActive() { return activate(activeTab); }

  function storeForTab(tab) {
    if (!tab) return null;
    return tab.view === "todo" ? session.todoStore
      : tab.view === "scratchpad" ? session.scratchpadStore
      : tab.view === "week" ? session.weekStore
      : session.dailyStore;
  }

  function detachTab(id) {
    const tab = tabs.find((item) => item.id === id);
    if (!tab) return null;
    tabs = tabs.filter((item) => item.id !== id);
    if (activeId === id) activeId = tabs.at(-1)?.id || "";
    return tab;
  }

  export async function checkActiveExternalChanges() {
    const store = storeForTab(activeTab);
    return store ? await store.checkExternalChanges() : false;
  }

  export async function transferTab(id, accept, { isCurrent: externalIsCurrent = () => true } = {}) {
    const tab = tabs.find((item) => item.id === id);
    if (!tab) return false;
    const intent = beginIntent();
    const isCurrent = () => intent.isCurrent() && externalIsCurrent();
    const wasActive = activeId === id;
    const nextTab = wasActive ? tabs.filter((item) => item.id !== id).at(-1) : null;
    let committed = false;
    const commit = () => {
      if (!isCurrent()) return;
      detachTab(id);
      committed = true;
    };
    const accepted = await accept(tab, storeForTab(tab), { isCurrent, commit });
    if (!accepted || !committed || !isCurrent()) return false;
    if (nextTab) {
      const nextIntent = beginIntent();
      if (!(await activate(nextTab, nextIntent)) && nextIntent.isCurrent()) activeId = "";
    } else if (!tabs.length) onEmpty?.();
    return true;
  }

  export async function acceptTransfer(tab, sourceStore, { isCurrent: sourceIsCurrent = () => true, commit = () => {} } = {}) {
    const intent = beginIntent();
    const targetStore = storeForTab(tab);
    const path = targetPathForTab(tab);
    const controller = sourceStore?.persistence;
    const canTransferOwnership = controller && controller.path === path && targetStore?.persistence;
    const isCurrent = () => intent.isCurrent() && sourceIsCurrent();
    const commitTransfer = () => {
      if (!tabs.some((item) => item.id === tab.id)) tabs = [...tabs, tab];
      activeId = tab.id;
      commit();
    };

    if (canTransferOwnership) {
      const storesReady = await Promise.all([sourceStore, targetStore].map((store) => flushStore(store, isCurrent)));
      if (!storesReady.every(Boolean) || !isCurrent()) return false;
      const week = tab.view === "week" ? workspaceStore.weeks.find((item) => item.indexPath === tab.path) : null;
      const context = tab.view === "week" ? { descriptor: descriptorFor(week), days: week?.days || [] }
        : tab.view === "day" ? { date: tab.date }
        : {};
      const result = await controller.transferTo(targetStore.persistence, { context, isCurrent, commit: commitTransfer });
      return succeeded(result) && isCurrent();
    }

    if (!(await load(tab, intent)) || !isCurrent()) return false;
    if (!isCurrent()) return false;
    commitTransfer();
    return true;
  }

  export async function releaseAllTabs({ isCurrent: externalIsCurrent = () => true, commit: externalCommit = () => {} } = {}) {
    const intent = beginIntent();
    const allTabs = tabs;
    const stores = [...new Set(allTabs.map(storeForTab).filter(Boolean))];
    const controllers = [...new Set(stores.map((store) => store.persistence).filter((controller) =>
      controller && typeof controller.cancelOpen === "function" && typeof controller.state === "function"
    ))];
    const isCurrent = () => intent.isCurrent() && externalIsCurrent();
    let committed = false;
    const commit = () => {
      tabs = [];
      activeId = "";
      committed = true;
      externalCommit();
    };
    let result;
    if (controllers.length) {
      const prepared = await Promise.all(stores.map((store) => flushStore(store, isCurrent)));
      result = prepared.every(Boolean) && isCurrent()
        ? await DocumentController.closeAll(controllers, { isCurrent, commit })
        : { status: "error" };
    }
    else {
      const flushed = await Promise.all(stores.map((store) => flushStore(store, isCurrent)));
      if (!flushed.every(Boolean) || !isCurrent()) result = { status: "error" };
      else { commit(); result = { status: "ok" }; }
    }
    if (!succeeded(result) || !committed) {
      appStore.showStatus(blockedSaveMessage("separating split view", stores));
      return null;
    }
    return allTabs;
  }

  export function acceptReleasedTabs(releasedTabs, preferredActiveId = "") {
    const knownIds = new Set(tabs.map((tab) => tab.id));
    const additions = releasedTabs.filter((tab) => !knownIds.has(tab.id));
    tabs = [...tabs, ...additions];
    if (!activeId && additions.length) activeId = additions.find((tab) => tab.id === preferredActiveId)?.id || additions[0].id;
  }

  export async function closeTabsUnder(path) {
    const matchingTabs = tabs.filter((tab) => tab.path && tab.path.startsWith(path));
    for (const tab of matchingTabs) await close(tab);
  }

  async function flushTab(tab, isCurrent = () => true) {
    const store = storeForTab(tab);
    return store ? await flushStore(store, isCurrent) : true;
  }

  async function flushStore(store, isCurrent = () => true) {
    const result = typeof store.flushSave === "function"
      ? await store.flushSave()
      : store.persistence?.flush ? await store.persistence.flush({ isCurrent }) : true;
    return succeeded(result) && isCurrent();
  }

  async function close(tab) {
    const intent = beginIntent();
    const store = storeForTab(tab);
    const path = pathForTab(tab);
    const ownsClosingPath = store?.persistence ? store.persistence.path === path : path === (store?.loadedPath || store?.path);
    const replacement = tabs.some((item) => item.id !== tab.id && pathForTab(item) === path && path);

    if (ownsClosingPath && !replacement) {
      if (!(await flushStore(store, intent.isCurrent)) || !intent.isCurrent()) {
        if (intent.isCurrent()) appStore.showStatus(blockedSaveMessage("closing the tab", [store]));
        return false;
      }
      const result = store.persistence?.close
        ? await DocumentController.closeAll([store.persistence], { isCurrent: intent.isCurrent })
        : await flushStore(store, intent.isCurrent);
      if (!succeeded(result) || !intent.isCurrent()) {
        if (intent.isCurrent()) appStore.showStatus(blockedSaveMessage("closing the tab", [store]));
        return false;
      }
    } else if (ownsClosingPath && !(await flushTab(tab, intent.isCurrent))) {
      if (intent.isCurrent()) appStore.showStatus(blockedSaveMessage("closing the tab", [store]));
      return false;
    }

    if (!intent.isCurrent()) return false;
    tabs = tabs.filter((item) => item.id !== tab.id);
    if (activeId !== tab.id) return true;
    const next = tabs.at(-1);
    activeId = next?.id || "";
    if (next) await activate(next);
    else onEmpty?.();
    return true;
  }

  function requestSplit(tab) {
    if (tab.id === activeId) {
      appStore.showStatus("Choose another tab to open beside the current one");
      return;
    }
    onRequestSplit?.(tab);
  }
  let activeTab = $derived(tabs.find((tab) => tab.id === activeId));
  let activeStore = $derived(storeForTab(activeTab));
</script>

<section class="pane" role="presentation" onpointerdown={handlePaneFocus}>
  <WorkspaceTabs {tabs} {activeId} {focused} onActivate={activate} onClose={close} onSplit={onRequestSplit ? requestSplit : null} {onMoveToLeft} {onMoveToRight} {onSeparate} />
  <div class="panel-scroll" class:todo-scroll={activeTab?.view === "todo"}>
    {#if activeTab?.view === "todo"}<TodoPanel {...session} />
    {:else if activeTab?.view === "scratchpad"}<ScratchpadPanel scratchpadStore={session.scratchpadStore} />
    {:else if activeTab?.view === "week"}<WeekPanel weekStore={session.weekStore} />
    {:else if activeTab?.view === "day"}<DailyPanel dailyStore={session.dailyStore} weekStore={session.weekStore} />
    {:else}<div class="empty">No tabs open</div>{/if}
  </div>
  {#if activeStore?.conflict}
    <ConflictBanner
      onReloadExternal={() => activeStore.resolveConflict("reload")}
      onKeepLocal={() => activeStore.resolveConflict("keep-local")}
    />
  {/if}
  {#if activeTab?.view === "todo" && !session.todoStore.fileMissing}<TodoToolbar selectedCount={0} undoStackLength={session.todoStore.undoStack.length} redoStackLength={session.todoStore.redoStack.length} onAddTodo={() => session.todoStore.addTodo(-1, 0)} onUndo={() => session.todoStore.undo()} onRedo={() => session.todoStore.redo()} onReload={() => openTodo()} onClearCompleted={() => session.todoStore.clearCompleted()} />{/if}
</section>

<style>
  .pane { display: flex; flex: 1; min-width: 0; min-height: 0; flex-direction: column; background: var(--bg-panel); }
  .panel-scroll { flex: 1; min-width: 0; min-height: 0; overflow: auto; scrollbar-width: none; }
  .panel-scroll.todo-scroll { scrollbar-width: thin; scrollbar-color: #333 transparent; }
  .empty { display: grid; height: 100%; place-items: center; color: var(--text-muted); }
</style>
