<script lang="ts">
  import NotesEditor from "$lib/shared/components/NotesEditor.svelte";
  import { scratchpadStore as defaultScratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.ts";
  import { workspaceStore } from "$lib/app/workspaceStore.svelte.ts";
  import type { ScratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.ts";
  let { scratchpadStore = defaultScratchpadStore }: { scratchpadStore?: ScratchpadStore } = $props();
</script>

<main class="scratchpad-panel">
  {#if scratchpadStore.fileMissing}
    <div class="empty">
      <strong>No scratchpad.md found</strong>
      <span>Create it when you are ready to use Scratchpad.</span>
      <button onclick={() => workspaceStore.createScratchpad()}>Create scratchpad</button>
    </div>
  {:else if !scratchpadStore.loaded}
    <div class="empty"><strong>Scratchpad unavailable</strong><span>Open Scratchpad again to retry.</span></div>
  {:else}
    <div class="scratchpad-editor">
      <NotesEditor
        value={scratchpadStore.content}
        onChange={(value: string) => scratchpadStore.updateContent(value)}
        label="Scratchpad"
        helpPlacement="below"
        folding={true}
        filePath={scratchpadStore.path}
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
    padding: 16px;
    box-sizing: border-box;
  }
  .scratchpad-editor {
    min-height: 150px;
  }
  .empty button {
    min-height: 34px;
    margin-top: 16px;
    padding: 0 16px;
    border: 1px solid var(--border-color);
    border-radius: 5px;
    background: var(--surface-2);
    color: var(--text-color);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 500;
  }
  .empty button:hover {
    border-color: var(--border-strong);
    background: var(--surface-hover);
  }
</style>
