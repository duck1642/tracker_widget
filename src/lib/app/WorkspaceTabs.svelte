<script>
  // @ts-nocheck
  import { X } from "@lucide/svelte";
  import ContextMenu from "$lib/shared/components/ContextMenu.svelte";

  let { tabs = [], activeId = "", onActivate = () => {}, onClose = () => {}, onSplit = null, onSeparate = null } = $props();
  let tabContextMenu = $state(null);

  function openTabContextMenu(event, tab) {
    event.preventDefault();
    tabContextMenu = { tab, x: event.clientX, y: event.clientY };
  }

  function closeFromContextMenu() {
    const tab = tabContextMenu?.tab;
    tabContextMenu = null;
    if (tab) onClose(tab);
  }

  function splitFromContextMenu() {
    const tab = tabContextMenu?.tab;
    tabContextMenu = null;
    if (tab) onSplit?.(tab);
  }

  function separateFromContextMenu() {
    tabContextMenu = null;
    onSeparate?.();
  }

</script>

{#if tabs.length}
  <nav class="workspace-tabs" aria-label="Open workspace tabs">
    {#each tabs as tab (tab.id)}
      <div class:active={tab.id === activeId} class="tab">
        <button class="tab-label" type="button" onclick={() => onActivate(tab)} onmousedown={(event) => { if (event.button === 1) event.preventDefault(); }} onauxclick={(event) => { if (event.button === 1) { event.preventDefault(); onClose(tab); } }} oncontextmenu={(event) => openTabContextMenu(event, tab)} title={`Open ${tab.title}`}>{tab.title}</button>
        <button class="tab-close" type="button" onclick={() => onClose(tab)} onmousedown={(event) => { if (event.button === 1) event.preventDefault(); }} onauxclick={(event) => { if (event.button === 1) { event.preventDefault(); onClose(tab); } }} oncontextmenu={(event) => openTabContextMenu(event, tab)} aria-label={`Close ${tab.title}`} title={`Close ${tab.title}`}><X size={13} /></button>
      </div>
    {/each}
  </nav>
{/if}

{#if tabContextMenu}
  <ContextMenu
    x={tabContextMenu.x}
    y={tabContextMenu.y}
    items={[...(onSplit ? [{ label: "Open in split view", onclick: splitFromContextMenu }] : []), ...(onSeparate ? [{ label: "Separate split view", onclick: separateFromContextMenu }] : []), { label: "Close tab", onclick: closeFromContextMenu }]}
    width={150}
    ariaLabel={`${tabContextMenu.tab.title} tab actions`}
    onDismiss={() => tabContextMenu = null}
  />
{/if}

<style>
  .workspace-tabs { display: flex; align-items: stretch; gap: 2px; min-height: 32px; padding: 5px 8px 0; overflow-x: auto; background: var(--surface); border-bottom: 1px solid var(--border-color); scrollbar-width: none; }
  .workspace-tabs::-webkit-scrollbar { display: none; }
  .tab { display: flex; align-items: center; max-width: 210px; border: 1px solid transparent; border-bottom: 0; border-radius: 6px 6px 0 0; color: var(--text-muted); }
  .tab.active { background: var(--bg-panel); border-color: var(--border-color); color: var(--text-color); }
  .tab-label, .tab-close { border: 0; background: transparent; color: inherit; cursor: pointer; }
  .tab-label { min-width: 0; padding: 7px 7px 8px 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--text-xs); }
  .tab-close { display: grid; place-items: center; margin-right: 4px; width: 21px; height: 21px; }
  .tab-close:hover { color: #ff5555; }
</style>
