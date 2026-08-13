<script>
  // @ts-nocheck
  import { ArrowLeft, ArrowRight, CalendarCheck, CalendarPlus, ArrowDownUp, CheckSquare2, ChevronsDownUp, ChevronsUpDown, Columns2, ExternalLink, FileCog, Plus, StickyNote, Trash2 } from "@lucide/svelte";
  import { openPath } from "@tauri-apps/plugin-opener";
  import FileTree from "$lib/shared/components/FileTree.svelte";
  import ContextMenu from "$lib/shared/components/ContextMenu.svelte";
  import WeekFilesDialog from "./WeekFilesDialog.svelte";
  import WeekFilesMenu from "./WeekFilesMenu.svelte";
  import { workspaceStore } from "./workspaceStore.svelte.js";
  import { appStore } from "$lib/app/appStore.svelte.js";
  import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
  import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
  import { todoStore } from "$lib/features/todo/todoStore.svelte.js";
  import { scratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.js";

  let {
    open = true,
    currentView = "todo",
    selectedPath = "",
    onSelectScratchpad = () => {},
    onSelectTodo = () => {},
    onSelectWeek,
    onSelectDay,
    onOpenWeekInBackground = null,
    onOpenDayInBackground = null,
    onMiddleClickTodo = null,
    onMiddleClickScratchpad = null,
    splitView = false,
    onOpenTodoInSplit = null,
    onOpenScratchpadInSplit = null,
    onOpenWeekInSplit = null,
    onOpenDayInSplit = null,
    onOpenTodoInPane = null,
    onOpenScratchpadInPane = null,
    onOpenWeekInPane = null,
    onOpenDayInPane = null,
    onRepairWeek = (week) => workspaceStore.repairWeek(week),
    onConvertWeek = (week) => workspaceStore.convertWeekToPersonal(week),
    onDeleteWeek = () => {},
    keyboardNavigationEnabled = true
  } = $props();
  let sortAscending = $state(false);
  let allWeeksExpanded = $state(true);
  let expansionCommand = $state(null);
  let expansionCommandId = 0;
  let sortedWeeks = $derived([...workspaceStore.weeks].sort((left, right) => sortAscending ? left.name.localeCompare(right.name) : right.name.localeCompare(left.name)));
  let sortDescription = $derived(sortAscending
    ? "Week order: oldest first — click for newest first"
    : "Week order: newest first — click for oldest first");
  let queuedNavigationPath = "";
  let navigationQueue = Promise.resolve();
  let weekFilesMenu = $state(null);
  let showWeekFilesDialog = $state(false);
  let weekContextMenu = $state(null);
  let sidebarContextMenu = $state(null);
  let weekContextItems = $derived.by(() => {
    if (!weekContextMenu) return [];
    const week = weekContextMenu.week;
    return [
      { label: "Check/repair week", icon: CalendarCheck, onclick: () => runWeekContextAction(onRepairWeek, week) },
      ...(appStore.frontmatterMode === "personal"
        ? [{ label: "Convert to personal", icon: FileCog, onclick: () => runWeekContextAction(onConvertWeek, week) }]
        : []),
      { separator: true },
      { label: "Delete week…", icon: Trash2, danger: true, onclick: () => runWeekContextAction(onDeleteWeek, week) }
    ];
  });
  let sidebarContextItems = $derived.by(() => {
    if (!sidebarContextMenu) return [];
    const openInNewTab =
      { label: "Open in new tab", icon: Plus, onclick: () => runSidebarContextAction(sidebarContextMenu.openInBackground) };
    if (!splitView) return [
      openInNewTab,
      { label: "Open in split view", icon: Columns2, onclick: () => runSidebarContextAction(sidebarContextMenu.openInSplit) }
    ];
    return [
      openInNewTab,
      { label: "Open at left pane", icon: ArrowLeft, onclick: () => runSidebarContextAction(sidebarContextMenu.openInLeft) },
      { label: "Open at right pane", icon: ArrowRight, onclick: () => runSidebarContextAction(sidebarContextMenu.openInRight) }
    ];
  });

  const EDITOR_BLUR_SETTLE_MS = 160;

  function navigationEntries() {
    return sortedWeeks.flatMap((week) => [
      ...(week.indexPath ? [{ kind: "week", path: week.indexPath, week }] : []),
      ...week.days.filter((day) => day.path).map((day) => ({ kind: "day", path: day.path, week, day }))
    ]);
  }

  function keyboardNavigationBlocked() {
    return !keyboardNavigationEnabled
      || !["week", "day"].includes(appStore.currentView)
      || Boolean(document.querySelector('[role="dialog"], [role="menu"]'));
  }

  async function settleActiveEditor() {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) return;
    if (!activeElement.matches('input, textarea, select, [contenteditable="true"]')) return;

    activeElement.blur();
    await new Promise((resolve) => setTimeout(resolve, EDITOR_BLUR_SETTLE_MS));
  }

  function handleKeyboardNavigation(event) {
    if (event.key === "Escape" && weekFilesMenu) {
      weekFilesMenu = null;
      return;
    }
    if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (event.key !== "PageUp" && event.key !== "PageDown") return;

    event.preventDefault();
    if (keyboardNavigationBlocked()) return;

    const entries = navigationEntries();
    const currentIndex = entries.findIndex((entry) => entry.path === (queuedNavigationPath || selectedPath));
    if (currentIndex < 0) return;

    const direction = event.key === "PageDown" ? 1 : -1;
    const destination = entries[currentIndex + direction];
    if (!destination) return;

    queuedNavigationPath = destination.path;
    navigationQueue = navigationQueue
      .then(async () => {
        await settleActiveEditor();
        if (destination.kind === "week") {
          await onSelectWeek(destination.week);
        } else {
          await onSelectDay(destination.day, destination.week);
        }
      })
      .catch((error) => appStore.showStatus("File navigation failed: " + error))
      .finally(() => {
        if (queuedNavigationPath === destination.path) queuedNavigationPath = "";
      });
  }

  function toggleWeekFilesMenu(event) {
    if (weekFilesMenu) {
      weekFilesMenu = null;
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    weekFilesMenu = { x: rect.left, y: rect.bottom + 5 };
  }

  function dismissWeekFilesMenu(event) {
    if (!weekFilesMenu) return;
    if (event.target instanceof Element && event.target.closest("[data-week-files-menu], [data-week-files-trigger]")) return;
    weekFilesMenu = null;
  }

  async function runWeekFilesAction(action) {
    weekFilesMenu = null;
    await action();
  }

  function openWeekContextMenu(event, week) {
    weekFilesMenu = null;
    weekContextMenu = { week, x: event.clientX, y: event.clientY };
  }

  function runWeekContextAction(action, week) {
    weekContextMenu = null;
    void action(week);
  }

  function openSidebarContextMenu(event, openInBackground, openInSplit = null, openInLeft = null, openInRight = null) {
    weekFilesMenu = null;
    sidebarContextMenu = { x: event.clientX, y: event.clientY, openInBackground, openInSplit, openInLeft, openInRight };
  }

  function runSidebarContextAction(action) {
    sidebarContextMenu = null;
    action?.();
  }

  function toggleAllWeeks() {
    allWeeksExpanded = !allWeeksExpanded;
    expansionCommand = { id: ++expansionCommandId, expanded: allWeeksExpanded };
  }

  async function openActiveMarkdown() {
    let targetPath = "";
    if (appStore.currentView === "todo") {
      targetPath = todoStore.loadedPath || appStore.filePath;
    } else if (appStore.currentView === "week") {
      targetPath = weekStore.path;
    } else if (appStore.currentView === "day") {
      targetPath = dailyStore.path;
    } else if (appStore.currentView === "scratchpad") {
      targetPath = scratchpadStore.loaded ? scratchpadStore.path : "";
    }

    if (targetPath) {
      try {
        await openPath(targetPath);
      } catch (err) {
        appStore.showStatus("Failed to open: " + err);
      }
    } else {
      appStore.showStatus("No active file");
    }
  }
</script>

<svelte:window onkeydown={handleKeyboardNavigation} onpointerdown={dismissWeekFilesMenu} />

<aside class:closed={!open}>
  <div class="actions">
    <button
      data-week-files-trigger
      onclick={toggleWeekFilesMenu}
      aria-label="Week files"
      title="Week files"
      aria-haspopup="menu"
      aria-expanded={Boolean(weekFilesMenu)}
    ><CalendarPlus size={15} /></button>
    <button onclick={() => sortAscending = !sortAscending} aria-label={sortDescription} title={sortDescription}><ArrowDownUp size={15} /></button>
    <button onclick={toggleAllWeeks} aria-label={allWeeksExpanded ? "Collapse all weeks" : "Expand all weeks"} title={allWeeksExpanded ? "Collapse all weeks" : "Expand all weeks"}>{#if allWeeksExpanded}<ChevronsDownUp size={15} />{:else}<ChevronsUpDown size={15} />{/if}</button>
    <button onclick={openActiveMarkdown} aria-label="Open active file in system editor" title="Open active file in system editor"><ExternalLink size={15} /></button>
  </div>
  <nav class="primary-views" aria-label="Primary views">
    <button
      class="view-entry"
      class:active={currentView === "scratchpad"}
      onclick={onSelectScratchpad}
      onmousedown={(event) => { if (event.button === 1) event.preventDefault(); }}
      onauxclick={(event) => { if (event.button === 1) { event.preventDefault(); onMiddleClickScratchpad?.(); } }}
      oncontextmenu={(event) => { event.preventDefault(); openSidebarContextMenu(event, onMiddleClickScratchpad, onOpenScratchpadInSplit, () => onOpenScratchpadInPane?.("left"), () => onOpenScratchpadInPane?.("right")); }}
      aria-current={currentView === "scratchpad" ? "page" : undefined}
    >
      <StickyNote size={14} />
      <span>Scratchpad</span>
    </button>
    <button
      class="view-entry"
      class:active={currentView === "todo"}
      onclick={onSelectTodo}
      onmousedown={(event) => { if (event.button === 1) event.preventDefault(); }}
      onauxclick={(event) => { if (event.button === 1) { event.preventDefault(); onMiddleClickTodo?.(); } }}
      oncontextmenu={(event) => { event.preventDefault(); openSidebarContextMenu(event, onMiddleClickTodo, onOpenTodoInSplit, () => onOpenTodoInPane?.("left"), () => onOpenTodoInPane?.("right")); }}
      aria-current={currentView === "todo" ? "page" : undefined}
    >
      <CheckSquare2 size={14} />
      <span>Todo</span>
    </button>
  </nav>
  {#if weekFilesMenu}
    <WeekFilesMenu
      x={weekFilesMenu.x}
      y={weekFilesMenu.y}
      onCurrent={() => runWeekFilesAction(() => workspaceStore.createCurrentWeekFiles())}
      onNext={() => runWeekFilesAction(() => workspaceStore.createNextWeekFiles())}
      onChoose={() => {
        weekFilesMenu = null;
        showWeekFilesDialog = true;
      }}
    />
  {/if}
  {#if workspaceStore.unavailable}
    <div class="unavailable"><strong>Workspace unavailable</strong><span>Locate the existing workspace folder, select another one, or retry the configured path.</span><button onclick={() => workspaceStore.chooseRoot()}>Locate existing</button><button onclick={() => workspaceStore.chooseRoot()}>Select new</button><button onclick={() => workspaceStore.refresh()}>Retry</button></div>
  {:else}
    <FileTree weeks={sortedWeeks} {selectedPath} {onSelectWeek} {onSelectDay} {onOpenWeekInBackground} {onOpenDayInBackground} onOpenWeekItemContextMenu={(event, week) => openSidebarContextMenu(event, () => onOpenWeekInBackground?.(week), () => onOpenWeekInSplit?.(week), () => onOpenWeekInPane?.(week, "left"), () => onOpenWeekInPane?.(week, "right"))} onOpenDayContextMenu={(event, day) => openSidebarContextMenu(event, () => onOpenDayInBackground?.(day), () => onOpenDayInSplit?.(day), () => onOpenDayInPane?.(day, "left"), () => onOpenDayInPane?.(day, "right"))} onOpenWeekContextMenu={openWeekContextMenu} {expansionCommand} />
  {/if}
</aside>

{#if weekContextMenu}
  <ContextMenu
    x={weekContextMenu.x}
    y={weekContextMenu.y}
    items={weekContextItems}
    width={174}
    ariaLabel={`${weekContextMenu.week.name} actions`}
    onDismiss={() => weekContextMenu = null}
  />
{/if}

{#if sidebarContextMenu}
  <ContextMenu
    x={sidebarContextMenu.x}
    y={sidebarContextMenu.y}
    items={sidebarContextItems}
    width={174}
    ariaLabel="Sidebar actions"
    onDismiss={() => sidebarContextMenu = null}
  />
{/if}

{#if showWeekFilesDialog}
  <WeekFilesDialog
    onClose={() => showWeekFilesDialog = false}
    onSubmit={(year, week, count) => workspaceStore.createSelectedWeekFiles(year, week, count)}
  />
{/if}

<style>
  aside { position: relative; display: grid; grid-template-rows: auto auto 1fr; flex: 0 0 180px; width: 180px; height: 100%; border-right: 1px solid var(--border-color); background: var(--surface); overflow: hidden; }
  .actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; padding: 10px 10px 9px; }
  .actions button { display: grid; place-items: center; width: 100%; min-width: 0; height: 34px; padding: 0; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-muted); cursor: pointer; }
  .actions button:hover { color: var(--text-color); border-color: var(--border-strong); }
  .primary-views { display: grid; gap: 2px; margin: 0 9px 7px; }
  .view-entry { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 30px; padding: 0 8px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--text-muted); cursor: pointer; font-size: var(--text-sm); text-align: left; }
  .view-entry:hover { color: var(--text-color); background: var(--surface-hover); }
  .view-entry.active { color: var(--accent); border-color: var(--border-color); background: var(--accent-soft); }
  .unavailable { display: grid; align-content: start; gap: 8px; margin: 8px; padding: 14px; color: var(--text-muted); font-size: var(--text-sm); }
  .unavailable button { min-height: 34px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-color); cursor: pointer; }
  .unavailable button:hover { border-color: var(--border-strong); background: var(--surface-hover); }
  aside.closed { display: none; }
  @media (max-width: 500px) { aside { position: absolute !important; inset: 32px auto 0 0 !important; z-index: 40; height: calc(100% - 32px) !important; box-shadow: 16px 0 36px rgba(0,0,0,.36); } }
</style>
