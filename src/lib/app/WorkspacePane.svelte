<script lang="ts">
  import type { FocusDetail, WorkspaceSession, WorkspaceTab, SessionStore, TransferOptions, TransferAcceptor, OpenOptions } from "./types.ts";
  import type { LogDayEntry, LogWeekEntry } from "$lib/shared/services/types.ts";
  import type { DocumentResult } from "$lib/shared/persistence/documentController.ts";
  type Intent = {isCurrent:()=>boolean};

  import { createEventDispatcher, onDestroy } from "svelte";
  import { getWeekDescriptor, scratchpadPathForWorkspace } from "$lib/shared/services/logWorkspaceService.ts";
  import { appStore } from "./appStore.svelte.ts";
  import { workspaceStore } from "./workspaceStore.svelte.ts";
  import { blockedSaveMessage } from "./persistenceRegistry.ts";
  import { DocumentController, documentSucceeded } from "$lib/shared/persistence/documentController.ts";
  import WorkspaceTabs from "./WorkspaceTabs.svelte";
  import TodoPanel from "$lib/features/todo/components/TodoPanel.svelte";
  import TodoToolbar from "$lib/features/todo/components/TodoToolbar.svelte";
  import DailyPanel from "$lib/features/daily/components/DailyPanel.svelte";
  import WeekPanel from "$lib/features/weekly/components/WeekPanel.svelte";
  import ScratchpadPanel from "$lib/features/scratchpad/components/ScratchpadPanel.svelte";
  import ConflictBanner from "$lib/shared/components/ConflictBanner.svelte";

  function succeeded(result: boolean | DocumentResult | undefined) {
    return typeof result === "boolean" ? result : Boolean(result && documentSucceeded(result));
  }

  let { session, initialTabs = [], focused = true, onFocused = () => {}, onRequestSplit = null, onMoveToLeft = null, onMoveToRight = null, onEmpty = null, onSeparate = null }: {

      session: WorkspaceSession;

      initialTabs?: WorkspaceTab[];

      focused?: boolean;

      onFocused?(detail: FocusDetail): unknown;

      onRequestSplit?: ((tab: WorkspaceTab) => unknown) | null;

      onMoveToLeft?: ((tab: WorkspaceTab) => unknown) | null;

      onMoveToRight?: ((tab: WorkspaceTab) => unknown) | null;

      onEmpty?: (() => unknown) | null;

      onSeparate?: (() => unknown) | null;

  } = $props();
  let tabs = $state<WorkspaceTab[]>([]);
  let activeId = $state("");
  let initialized = $state(false);
  const dispatch = createEventDispatcher<{focus:FocusDetail}>();
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

  function descriptorFor(week: LogWeekEntry | null | undefined) {
    const date = week?.days[0]?.date ? new Date(`${week.days[0].date}T12:00:00`) : new Date();
    return getWeekDescriptor(date);
  }

  function tabFor(view:"todo"|"scratchpad"): WorkspaceTab;
  function tabFor(view:"week", data:LogWeekEntry): WorkspaceTab;
  function tabFor(view:"day", data:LogDayEntry): WorkspaceTab;
  function tabFor(view:"todo"|"scratchpad"|"week"|"day", data?:LogWeekEntry|LogDayEntry): WorkspaceTab {
    if(view === "todo") return {id:"todo",view,title:"Todo",path:""};
    if(view === "scratchpad") return {id:"scratchpad",view,title:"Scratchpad",path:scratchpadPathForWorkspace(appStore.logsRootPath)};
    if(view === "week" && data && "indexPath" in data) return {id:`week:${data.indexPath}`,view,title:data.name,path:data.indexPath || ""};
    if(data && "date" in data) return {id:`day:${data.path}`,view:"day",title:data.date,path:data.path,date:data.date};
    throw new Error("Tab data is required");
  }

  function pathForTab(tab:WorkspaceTab | undefined) {
    if (!tab) return "";
    return tab.view === "todo" ? session.todoStore.loadedPath || appStore.filePath
      : tab.view === "scratchpad" ? tab.path
      : tab.path;
  }

  function targetPathForTab(tab:WorkspaceTab | undefined) {
    return tab?.view === "todo" ? appStore.filePath : tab?.path || "";
  }

  function hasConflictForTab(tab:WorkspaceTab) {
    const persistence = storeForTab(tab)?.persistence;
    const state = persistence?.state();
    return Boolean(state?.conflict && persistence?.path === targetPathForTab(tab));
  }

  async function load(tab:WorkspaceTab | undefined, intent:Intent) {
    if (!tab || !intent.isCurrent()) return false;
    let result;
    if (tab.view === "todo") {
      result = await session.todoStore.loadFile({ path: targetPathForTab(tab), isCurrent: intent.isCurrent });
    } else if (tab.view === "scratchpad") {
      const store = session.scratchpadStore;
      result = await store.loadPath(tab.path, { isCurrent: intent.isCurrent });
    } else if (tab.view === "week") {
      const week = workspaceStore.weeks.find((item) => item.indexPath === tab.path);
      if (!week) return false;
      result = await session.weekStore.loadPath(tab.path, descriptorFor(week), week.days, { isCurrent: intent.isCurrent });
    } else if (tab.view === "day") {
      result = await session.dailyStore.loadPath(tab.path, tab.date, { isCurrent: intent.isCurrent });
    }
    return intent.isCurrent() && (succeeded(result) || hasConflictForTab(tab));
  }

  function focus(tab:WorkspaceTab | undefined, intent:Intent) {
    if (!tab || !intent.isCurrent()) return false;
    activeId = tab.id;
    const detail = { view: tab.view, path: tab.path };
    onFocused(detail);
    dispatch("focus", detail);
    return true;
  }

  async function activate(tab:WorkspaceTab | undefined, intent:Intent = beginIntent()) {
    if (!(await load(tab, intent)) || !intent.isCurrent()) return false;
    return focus(tab, intent);
  }

  async function open(tab:WorkspaceTab, { background = false }:OpenOptions = {}) {
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

  export async function openTodo(options?:OpenOptions) { return open(tabFor("todo"), options); }
  export async function openScratchpad(options?:OpenOptions) { return open(tabFor("scratchpad"), options); }
  export async function openWeek(week:LogWeekEntry, options?:OpenOptions) { return open(tabFor("week", week), options); }
  export async function openDay(day:LogDayEntry, options?:OpenOptions) { return open(tabFor("day", day), options); }
  export async function openTab(tab:WorkspaceTab, options?:OpenOptions) { return open(tab, options); }

  export async function replaceActiveTab(tab:WorkspaceTab) {
    const intent = beginIntent();
    if (tab.id === activeId) return await activate(tab, intent);
    const previousTab = activeTab;
    if (previousTab && !(await flushTab(previousTab, intent.isCurrent))) {
      const previousStore = storeForTab(previousTab);
      if (intent.isCurrent()) appStore.showStatus(blockedSaveMessage("changing the tab", previousStore ? [previousStore] : []));
      return false;
    }
    if (!intent.isCurrent() || !(await load(tab, intent)) || !intent.isCurrent()) return false;
    tabs = previousTab ? tabs.map((item) => item.id === previousTab.id ? tab : item) : [tab];
    return focus(tab, intent);
  }

  export function hasTab(id:string) { return tabs.some((tab) => tab.id === id); }
  export function tabCount() { return tabs.length; }
  export function tabsSnapshot() { return [...tabs]; }
  export function activeTabId() { return activeId; }
  export function activeFilePath() {
    if (!activeTab) return "";
    return storeForTab(activeTab)?.persistence.path || pathForTab(activeTab);
  }
  export async function focusActive() { return activate(activeTab); }

  function storeForTab(tab:WorkspaceTab | undefined) {
    if (!tab) return null;
    return tab.view === "todo" ? session.todoStore
      : tab.view === "scratchpad" ? session.scratchpadStore
      : tab.view === "week" ? session.weekStore
      : session.dailyStore;
  }

  function detachTab(id:string) {
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

  export async function transferTab(id:string, accept:TransferAcceptor, { isCurrent: externalIsCurrent = () => true }:TransferOptions = {}) {
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

  export async function acceptTransfer(tab:WorkspaceTab, sourceStore:SessionStore | null, { isCurrent: sourceIsCurrent = () => true, commit = () => {} }:TransferOptions = {}) {
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

    if (canTransferOwnership && sourceStore && targetStore) {
      const storesReady = await Promise.all([sourceStore, targetStore].map((store) => flushStore(store, isCurrent)));
      if (!storesReady.every(Boolean) || !isCurrent()) return false;
      const week = tab.view === "week" ? workspaceStore.weeks.find((item) => item.indexPath === tab.path) : null;
      let result: DocumentResult;
      const options = { isCurrent, commit: commitTransfer };
      if (sourceStore.view === "todo" && targetStore.view === "todo") {
        result = await sourceStore.persistence.transferTo(targetStore.persistence, options);
      } else if (sourceStore.view === "scratchpad" && targetStore.view === "scratchpad") {
        result = await sourceStore.persistence.transferTo(targetStore.persistence, options);
      } else if (sourceStore.view === "week" && targetStore.view === "week") {
        result = await sourceStore.persistence.transferTo(targetStore.persistence, {
          ...options, context: { descriptor: descriptorFor(week), days: week?.days || [] }
        });
      } else if (sourceStore.view === "day" && targetStore.view === "day" && tab.view === "day") {
        result = await sourceStore.persistence.transferTo(targetStore.persistence, { ...options, context: { date: tab.date } });
      } else return false;
      return succeeded(result) && isCurrent();
    }

    if (!(await load(tab, intent)) || !isCurrent()) return false;
    if (!isCurrent()) return false;
    commitTransfer();
    return true;
  }

  export async function releaseAllTabs({ isCurrent: externalIsCurrent = () => true, commit: externalCommit = () => {} }:TransferOptions = {}) {
    const intent = beginIntent();
    const allTabs = tabs;
    const stores = [...new Set(allTabs.map(storeForTab).filter((store): store is SessionStore => store !== null))];
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
    let result: boolean | DocumentResult;
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

  export function acceptReleasedTabs(releasedTabs:WorkspaceTab[], preferredActiveId = "") {
    const knownIds = new Set(tabs.map((tab) => tab.id));
    const additions = releasedTabs.filter((tab) => !knownIds.has(tab.id));
    tabs = [...tabs, ...additions];
    if (!activeId && additions.length) activeId = additions.find((tab) => tab.id === preferredActiveId)?.id || additions[0].id;
  }

  export async function closeTabsUnder(path:string) {
    const matchingTabs = tabs.filter((tab) => tab.path && tab.path.startsWith(path));
    for (const tab of matchingTabs) await close(tab);
  }

  async function flushTab(tab:WorkspaceTab, isCurrent = () => true) {
    const store = storeForTab(tab);
    return store ? await flushStore(store, isCurrent) : true;
  }

  async function flushStore(store:SessionStore, isCurrent = () => true) {
    const result = typeof store.flushSave === "function"
      ? await store.flushSave()
      : store.persistence?.flush ? await store.persistence.flush() : true;
    return succeeded(result) && isCurrent();
  }

  async function close(tab:WorkspaceTab) {
    const intent = beginIntent();
    const store = storeForTab(tab);
    const path = pathForTab(tab);
    const ownsClosingPath = store?.persistence ? store.persistence.path === path : path === (store?.view === "todo" ? store.loadedPath : store?.path);
    const replacement = tabs.some((item) => item.id !== tab.id && pathForTab(item) === path && path);

    if (store && ownsClosingPath && !replacement) {
      if (!(await flushStore(store, intent.isCurrent)) || !intent.isCurrent()) {
        if (intent.isCurrent()) appStore.showStatus(blockedSaveMessage("closing the tab", [store]));
        return false;
      }
      const result = store.persistence
        ? await DocumentController.closeAll([store.persistence], { isCurrent: intent.isCurrent })
        : await flushStore(store, intent.isCurrent);
      if (!succeeded(result) || !intent.isCurrent()) {
        if (intent.isCurrent()) appStore.showStatus(blockedSaveMessage("closing the tab", [store]));
        return false;
      }
    } else if (store && ownsClosingPath && !(await flushTab(tab, intent.isCurrent))) {
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

  function requestSplit(tab:WorkspaceTab) {
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
