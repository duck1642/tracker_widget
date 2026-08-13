<script>
  // @ts-nocheck
  import { createEventDispatcher } from "svelte";
  import { getWeekDescriptor, scratchpadPathForWorkspace } from "$lib/shared/services/logWorkspaceService.js";
  import { appStore } from "./appStore.svelte.js";
  import { workspaceStore } from "./workspaceStore.svelte.js";
  import WorkspaceTabs from "./WorkspaceTabs.svelte";
  import TodoPanel from "$lib/features/todo/components/TodoPanel.svelte";
  import TodoToolbar from "$lib/features/todo/components/TodoToolbar.svelte";
  import DailyPanel from "$lib/features/daily/components/DailyPanel.svelte";
  import WeekPanel from "$lib/features/weekly/components/WeekPanel.svelte";
  import ScratchpadPanel from "$lib/features/scratchpad/components/ScratchpadPanel.svelte";

  let { session, initialTabs = [], onFocused = () => {}, onRequestSplit = null, onMoveToLeft = null, onMoveToRight = null, onEmpty = null, onSeparate = null } = $props();
  let tabs = $state([]);
  let activeId = $state("");
  let initialized = $state(false);
  const dispatch = createEventDispatcher();

  $effect(() => {
    if (initialized) return;
    initialized = true;
    if (!initialTabs.length) return;
    tabs = [...initialTabs];
    activeId = initialTabs[0].id;
  });

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

  async function activate(tab) {
    if (!tab) return false;
    if (tab.view === "todo") {
      if (!session.todoStore.loadedPath && !(await session.todoStore.loadFile())) return false;
    } else if (tab.view === "scratchpad") {
      if (!(await session.scratchpadStore.loadPath(tab.path))) return false;
    } else if (tab.view === "week") {
      const week = workspaceStore.weeks.find((item) => item.indexPath === tab.path);
      if (!week || !(await session.weekStore.loadPath(tab.path, descriptorFor(week), week.days))) return false;
    } else if (tab.view === "day") {
      if (!(await session.dailyStore.loadPath(tab.path, tab.date))) return false;
    }
    activeId = tab.id;
    onFocused({ view: tab.view, path: tab.path });
    dispatch("focus", { view: tab.view, path: tab.path });
    return true;
  }

  async function open(tab, { background = false } = {}) {
    if (!tabs.some((item) => item.id === tab.id)) tabs = [...tabs, tab];
    if (!background) return activate(tab);
    return true;
  }

  export async function openTodo(options) { return open(tabFor("todo"), options); }
  export async function openScratchpad(options) { return open(tabFor("scratchpad"), options); }
  export async function openWeek(week, options) { return open(tabFor("week", week), options); }
  export async function openDay(day, options) { return open(tabFor("day", day), options); }
  export async function openTab(tab, options) { return open(tab, options); }
  export function hasTab(id) { return tabs.some((tab) => tab.id === id); }
  export function tabCount() { return tabs.length; }
  export function activeTabId() { return activeId; }
  export function activeFilePath() {
    if (!activeTab) return "";
    if (activeTab.view === "todo") return session.todoStore.loadedPath || appStore.filePath;
    if (activeTab.view === "scratchpad") return session.scratchpadStore.path;
    if (activeTab.view === "week") return session.weekStore.path;
    return session.dailyStore.path;
  }
  export async function focusActive() { return activate(activeTab); }
  export function takeTab(id) {
    const tab = tabs.find((item) => item.id === id);
    if (!tab) return null;
    tabs = tabs.filter((item) => item.id !== id);
    if (activeId === id) activeId = tabs.at(-1)?.id || "";
    return tab;
  }
  export function takeAllTabs() {
    const allTabs = tabs;
    tabs = [];
    activeId = "";
    return allTabs;
  }

  export async function closeTabsUnder(path) {
    const matchingTabs = tabs.filter((tab) => tab.path && tab.path.startsWith(path));
    for (const tab of matchingTabs) await close(tab);
  }

  async function flushTab(tab) {
    const store = tab.view === "todo" ? session.todoStore
      : tab.view === "scratchpad" ? session.scratchpadStore
      : tab.view === "week" ? session.weekStore
      : session.dailyStore;
    return await store.flushSave();
  }

  async function close(tab) {
    if (!(await flushTab(tab))) {
      appStore.showStatus("Resolve file conflicts before closing the tab");
      return false;
    }
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
</script>

<section class="pane" role="presentation" onpointerdown={() => activeTab && onFocused({ view: activeTab.view, path: activeTab.path })}>
  <WorkspaceTabs {tabs} {activeId} onActivate={activate} onClose={close} onSplit={onRequestSplit ? requestSplit : null} {onMoveToLeft} {onMoveToRight} {onSeparate} />
  <div class="panel-scroll" class:todo-scroll={activeTab?.view === "todo"} class:scratchpad-scroll={activeTab?.view === "scratchpad"}>
    {#if activeTab?.view === "todo"}<TodoPanel {...session} />
    {:else if activeTab?.view === "scratchpad"}<ScratchpadPanel scratchpadStore={session.scratchpadStore} />
    {:else if activeTab?.view === "week"}<WeekPanel weekStore={session.weekStore} />
    {:else if activeTab?.view === "day"}<DailyPanel dailyStore={session.dailyStore} weekStore={session.weekStore} />
    {:else}<div class="empty">No tabs open</div>{/if}
  </div>
  {#if activeTab?.view === "todo" && !session.todoStore.fileMissing}<TodoToolbar selectedCount={0} undoStackLength={session.todoStore.undoStack.length} redoStackLength={session.todoStore.redoStack.length} onAddTodo={() => session.todoStore.addTodo(-1, 0)} onUndo={() => session.todoStore.undo()} onRedo={() => session.todoStore.redo()} onReload={() => session.todoStore.loadFile()} onClearCompleted={() => session.todoStore.clearCompleted()} />{/if}
</section>

<style>
  .pane { display: flex; flex: 1; min-width: 0; min-height: 0; flex-direction: column; background: var(--bg-panel); }
  .panel-scroll { flex: 1; min-height: 0; overflow: auto; scrollbar-width: none; }
  .panel-scroll.scratchpad-scroll { overflow: hidden; }
  .panel-scroll.todo-scroll { scrollbar-width: thin; scrollbar-color: #333 transparent; }
  .empty { display: grid; height: 100%; place-items: center; color: var(--text-muted); }
</style>
