<script>
  // @ts-nocheck
  import { Plus } from "@lucide/svelte";
  import ObjectiveRow from "./ObjectiveRow.svelte";
  let { objectives, onAdd, onUpdate, onDelete } = $props();
</script>

<section id="objectives" class="week-section">
  <header><div><h2>Objectives</h2></div></header>
  <div class="objectives-list">
    {#each objectives as objective (objective.id)}
      <ObjectiveRow {objective} onUpdate={(patch) => onUpdate(objective.id, patch)} onDelete={() => onDelete(objective.id)} />
    {/each}
    {#if objectives.length === 0}
      <p class="empty-copy">No objectives yet.</p>
    {/if}
    <div class="actions-footer">
      <button type="button" class="add-inline-btn" onclick={onAdd} title="Add objective">
        <Plus size={12} /> Add objective
      </button>
    </div>
  </div>
</section>

<style>
  .objectives-list { display: flex; flex-direction: column; }
  .actions-footer { display: flex; justify-content: flex-start; padding-top: 8px; }
  .objectives-list :global(.objective-card:last-of-type) { border-bottom: none; }
  .add-inline-btn { display: inline-flex; align-items: center; justify-content: center; gap: 3px; height: 28px; padding: 0 12px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-muted); font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
  .add-inline-btn:hover { background: var(--surface-hover); color: var(--text-color); border-color: var(--border-strong); }
</style>
