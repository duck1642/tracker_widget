<script>
  // @ts-nocheck
  import NotesEditor from "$lib/shared/components/NotesEditor.svelte";
  import ConflictBanner from "$lib/shared/components/ConflictBanner.svelte";
  import { scratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.js";
</script>

<main class="scratchpad-panel">
  {#if !scratchpadStore.loaded}
    <div class="empty"><strong>Scratchpad unavailable</strong><span>Open Scratchpad again to retry.</span></div>
  {:else}
    {#if scratchpadStore.conflict}
      <ConflictBanner
        onReloadExternal={() => scratchpadStore.resolveConflict("reload")}
        onKeepLocal={() => scratchpadStore.resolveConflict("keep-local")}
      />
    {/if}
    <div class="scratchpad-editor">
      <NotesEditor
        value={scratchpadStore.content}
        onChange={(value) => scratchpadStore.updateContent(value)}
        label="Scratchpad"
        fillHeight={true}
      />
    </div>
  {/if}
</main>

<style>
  .scratchpad-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 16px;
    box-sizing: border-box;
  }
  .scratchpad-editor {
    flex: 1;
    min-height: 0;
  }
</style>
