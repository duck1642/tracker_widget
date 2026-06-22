<script>
  // @ts-nocheck
  import { FolderOpen, FolderPlus, RefreshCw, ArrowDownUp } from "@lucide/svelte";
  import FileTree from "$lib/shared/components/FileTree.svelte";
  import { workspaceStore } from "./workspaceStore.svelte.js";
  let { open = true, selectedPath = "", onSelectWeek, onSelectDay } = $props();
  let sortAscending = $state(false);
  let sortedWeeks = $derived([...workspaceStore.weeks].sort((left, right) => sortAscending ? left.name.localeCompare(right.name) : right.name.localeCompare(left.name)));
</script>

<aside class:closed={!open}>
  <header>
    <div><span class="eyebrow">Workspace</span><strong>Log files</strong></div>
  </header>
  <div class="actions">
    <button onclick={() => workspaceStore.chooseRoot()} aria-label="Select logs folder" title="Select logs folder"><FolderOpen size={15} /></button>
    <button onclick={() => workspaceStore.createCurrentWeek(false)} aria-label="Create current week" title="Create current week"><FolderPlus size={15} /></button>
    <button onclick={() => workspaceStore.createCurrentWeek(true)} aria-label="Create missing files" title="Create missing files"><RefreshCw size={15} /></button>
    <button onclick={() => sortAscending = !sortAscending} aria-label="Toggle week sorting" title={sortAscending ? "Show newest weeks first" : "Show oldest weeks first"}><ArrowDownUp size={15} /></button>
  </div>
  {#if workspaceStore.unavailable}
    <div class="unavailable"><strong>Logs folder unavailable</strong><span>Locate the existing logs folder, select another one, or retry the configured path.</span><button onclick={() => workspaceStore.chooseRoot()}>Locate existing</button><button onclick={() => workspaceStore.chooseRoot()}>Select new</button><button onclick={() => workspaceStore.refresh()}>Retry</button></div>
  {:else}
    <FileTree weeks={sortedWeeks} {selectedPath} {onSelectWeek} {onSelectDay} />
  {/if}
</aside>

<style>
  aside { position: relative; display: grid; grid-template-rows: auto auto 1fr; flex: 0 0 180px; width: 180px; height: 100%; border-right: 1px solid var(--border-color); background: var(--surface); overflow: hidden; }
  header { display: flex; align-items: center; min-height: 41px; padding: 8px 12px 6px; box-sizing: border-box; }
  header div { display: grid; gap: 2px; }
  .eyebrow { color: var(--accent); font-size: 9px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
  strong { font-size: var(--text-sm); }
  .actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; padding: 0 10px 9px; }
  .actions button { display: grid; place-items: center; width: 100%; min-width: 0; height: 34px; padding: 0; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-muted); cursor: pointer; }
  .actions button:hover { color: var(--text-color); border-color: var(--border-strong); }
  .unavailable { display: grid; align-content: start; gap: 8px; margin: 8px; padding: 14px; border: 1px dashed var(--warning); border-radius: var(--radius-md); color: var(--text-muted); font-size: var(--text-sm); }
  .unavailable button { min-height: 34px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-color); cursor: pointer; }
  .unavailable button:hover { border-color: var(--border-strong); background: var(--surface-hover); }
  aside.closed { display: none; }
  @media (max-width: 720px) { aside { position: absolute !important; inset: 32px auto 0 0 !important; z-index: 40; height: calc(100% - 32px) !important; box-shadow: 16px 0 36px rgba(0,0,0,.36); } }
</style>
