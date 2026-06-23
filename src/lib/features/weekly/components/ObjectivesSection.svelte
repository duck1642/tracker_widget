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
      <button class="primary-small" onclick={onAdd}><Plus size={14} /> Add objective</button>
    </div>
  </div>
</section>

<style>
  .objectives-list { display: flex; flex-direction: column; }
  .actions-footer { display: flex; justify-content: flex-end; padding-top: 4px; }
  .objectives-list :global(.objective-card:last-of-type) { border-bottom: none; }
</style>
