<script>
  // @ts-nocheck
  import { CalendarPlus, ArrowDownUp, ChevronsDownUp, ChevronsUpDown, ExternalLink } from "@lucide/svelte";
  import { openPath } from "@tauri-apps/plugin-opener";
  import FileTree from "$lib/shared/components/FileTree.svelte";
  import WeekFilesDialog from "./WeekFilesDialog.svelte";
  import WeekFilesMenu from "./WeekFilesMenu.svelte";
  import { workspaceStore } from "./workspaceStore.svelte.js";
  import { appStore } from "$lib/app/appStore.svelte.js";
  import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
  import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
  import { todoStore } from "$lib/features/todo/todoStore.svelte.js";

  let { open = true, selectedPath = "", onSelectWeek, onSelectDay, keyboardNavigationEnabled = true } = $props();
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
    <FileTree weeks={sortedWeeks} {selectedPath} {onSelectWeek} {onSelectDay} {expansionCommand} />
  {/if}
</aside>

{#if showWeekFilesDialog}
  <WeekFilesDialog
    onClose={() => showWeekFilesDialog = false}
    onSubmit={(year, week, count) => workspaceStore.createSelectedWeekFiles(year, week, count)}
  />
{/if}

<style>
  aside { position: relative; display: grid; grid-template-rows: auto 1fr; flex: 0 0 180px; width: 180px; height: 100%; border-right: 1px solid var(--border-color); background: var(--surface); overflow: hidden; }
  .actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; padding: 10px 10px 9px; }
  .actions button { display: grid; place-items: center; width: 100%; min-width: 0; height: 34px; padding: 0; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-muted); cursor: pointer; }
  .actions button:hover { color: var(--text-color); border-color: var(--border-strong); }
  .unavailable { display: grid; align-content: start; gap: 8px; margin: 8px; padding: 14px; color: var(--text-muted); font-size: var(--text-sm); }
  .unavailable button { min-height: 34px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-color); cursor: pointer; }
  .unavailable button:hover { border-color: var(--border-strong); background: var(--surface-hover); }
  aside.closed { display: none; }
  @media (max-width: 500px) { aside { position: absolute !important; inset: 32px auto 0 0 !important; z-index: 40; height: calc(100% - 32px) !important; box-shadow: 16px 0 36px rgba(0,0,0,.36); } }
</style>
