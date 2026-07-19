<script>
  // @ts-nocheck
  import { Plus } from "@lucide/svelte";
  import ObjectiveRow from "./ObjectiveRow.svelte";
  import { buildVisibleObjectiveRows } from "../objectiveFolding.js";
  let { objectives, onAdd, onUpdate, onDelete, onMove, onIndent, onOutdent } = $props();

  let foldedObjectiveIds = $state([]);
  let visibleObjectives = $derived(buildVisibleObjectiveRows(objectives, foldedObjectiveIds));

  $effect(() => {
    const validFoldedIds = visibleObjectives.foldedIds;
    if (validFoldedIds.length !== foldedObjectiveIds.length || validFoldedIds.some((id, index) => id !== foldedObjectiveIds[index])) {
      foldedObjectiveIds = validFoldedIds;
    }
  });

  function toggleFold(id) {
    foldedObjectiveIds = foldedObjectiveIds.includes(id)
      ? foldedObjectiveIds.filter((item) => item !== id)
      : [...foldedObjectiveIds, id];
  }
</script>

<section id="objectives" class="week-section">
  <header><div><h2>Objectives</h2></div></header>
  <div class="objectives-list">
    {#each visibleObjectives.rows as row (row.objective.id)}
      <ObjectiveRow
        objective={row.objective}
        hasChildren={row.hasChildren}
        isFolded={row.isFolded}
        canMoveUp={row.index > 0}
        canMoveDown={row.index < objectives.length - 1}
        onToggleFold={() => toggleFold(row.objective.id)}
        onUpdate={(patch) => onUpdate(row.objective.id, patch)}
        onDelete={() => onDelete(row.objective.id)}
        onMoveUp={() => onMove(row.objective.id, "up")}
        onMoveDown={() => onMove(row.objective.id, "down")}
        onIndent={() => onIndent(row.objective.id)}
        onOutdent={() => onOutdent(row.objective.id)}
      />
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
  .actions-footer { display: flex; justify-content: flex-start; padding: 12px 0 2px; border-top: 1px solid var(--border-subtle); }
  .objectives-list :global(.objective-card:last-of-type) { border-bottom: none; }
  .add-activity-btn { display: flex; align-items: center; gap: 6px; min-height: 30px; border: 0; background: transparent; color: var(--accent); cursor: pointer; font-size: var(--text-sm); font-weight: 500; padding: 0; transition: color 0.15s ease; }
  .add-activity-btn:hover { color: var(--text-color); }
</style>
