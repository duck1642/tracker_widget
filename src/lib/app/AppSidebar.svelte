<script>
  // @ts-nocheck
  import { CalendarPlus, ArrowDownUp, ChevronsDownUp, ChevronsUpDown, ExternalLink } from "@lucide/svelte";
  import { openPath } from "@tauri-apps/plugin-opener";
  import FileTree from "$lib/shared/components/FileTree.svelte";
  import { workspaceStore } from "./workspaceStore.svelte.js";
  import { appStore } from "$lib/app/appStore.svelte.js";
  import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
  import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
  import { todoStore } from "$lib/features/tasks/todoStore.svelte.js";

  let { open = true, selectedPath = "", onSelectWeek, onSelectDay } = $props();
  let sortAscending = $state(false);
  let allWeeksExpanded = $state(true);
  let expansionCommand = $state(null);
  let expansionCommandId = 0;
  let sortedWeeks = $derived([...workspaceStore.weeks].sort((left, right) => sortAscending ? left.name.localeCompare(right.name) : right.name.localeCompare(left.name)));

  function toggleAllWeeks() {
    allWeeksExpanded = !allWeeksExpanded;
    expansionCommand = { id: ++expansionCommandId, expanded: allWeeksExpanded };
  }

  async function openActiveMarkdown() {
    let targetPath = "";
    if (appStore.currentView === "tasks") {
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

<aside class:closed={!open}>
  <div class="actions">
    <button onclick={() => workspaceStore.createCurrentWeekFiles()} aria-label="Create week files" title="Create week files"><CalendarPlus size={15} /></button>
    <button onclick={() => sortAscending = !sortAscending} aria-label="Toggle week sorting" title={sortAscending ? "Sort: Oldest weeks first" : "Sort: Newest weeks first"}><ArrowDownUp size={15} /></button>
    <button onclick={toggleAllWeeks} aria-label={allWeeksExpanded ? "Collapse all weeks" : "Expand all weeks"} title={allWeeksExpanded ? "Collapse all weeks" : "Expand all weeks"}>{#if allWeeksExpanded}<ChevronsDownUp size={15} />{:else}<ChevronsUpDown size={15} />{/if}</button>
    <button onclick={openActiveMarkdown} aria-label="Open active file in system editor" title="Open active file in system editor"><ExternalLink size={15} /></button>
  </div>
  {#if workspaceStore.unavailable}
    <div class="unavailable"><strong>Workspace unavailable</strong><span>Locate the existing workspace folder, select another one, or retry the configured path.</span><button onclick={() => workspaceStore.chooseRoot()}>Locate existing</button><button onclick={() => workspaceStore.chooseRoot()}>Select new</button><button onclick={() => workspaceStore.refresh()}>Retry</button></div>
  {:else}
    <FileTree weeks={sortedWeeks} {selectedPath} {onSelectWeek} {onSelectDay} {expansionCommand} />
  {/if}
</aside>

<style>
  aside { position: relative; display: grid; grid-template-rows: auto 1fr; flex: 0 0 180px; width: 180px; height: 100%; border-right: 1px solid var(--border-color); background: var(--surface); overflow: hidden; }
  .actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; padding: 10px 10px 9px; }
  .actions button { display: grid; place-items: center; width: 100%; min-width: 0; height: 34px; padding: 0; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-muted); cursor: pointer; }
  .actions button:hover { color: var(--text-color); border-color: var(--border-strong); }
  .unavailable { display: grid; align-content: start; gap: 8px; margin: 8px; padding: 14px; color: var(--text-muted); font-size: var(--text-sm); }
  .unavailable button { min-height: 34px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-color); cursor: pointer; }
  .unavailable button:hover { border-color: var(--border-strong); background: var(--surface-hover); }
  aside.closed { display: none; }
  @media (max-width: 720px) { aside { position: absolute !important; inset: 32px auto 0 0 !important; z-index: 40; height: calc(100% - 32px) !important; box-shadow: 16px 0 36px rgba(0,0,0,.36); } }
</style>
