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
      <button type="button" class="add-activity-btn" onclick={onAdd} title="Add objective">
        <Plus size={14} /> Add objective
      </button>
    </div>
  </div>
</section>

<style>
  .objectives-list { display: flex; flex-direction: column; }
  .actions-footer { display: flex; justify-content: flex-start; padding-top: 8px; border-top: 1px solid var(--border-subtle); }
  .objectives-list :global(.objective-card:last-of-type) { border-bottom: none; }
  .add-activity-btn { display: flex; align-items: center; gap: 6px; min-height: 30px; border: 0; background: transparent; color: var(--accent); cursor: pointer; font-size: var(--text-sm); font-weight: 500; padding: 0; transition: color 0.15s ease; }
  .add-activity-btn:hover { color: var(--text-color); }
</style>
