<script>
  // @ts-nocheck
  import { Plus } from "@lucide/svelte";
  import ObjectiveRow from "./ObjectiveRow.svelte";
  let { objectives, onAdd, onUpdate, onDelete } = $props();
</script>

<section id="objectives" class="week-section">
  <header><div><span class="section-index">01</span><h2>Objectives</h2></div><button class="primary-small" onclick={onAdd}><Plus size={14} /> Add objective</button></header>
  <div>{#each objectives as objective (objective.id)}<ObjectiveRow {objective} onUpdate={(patch) => onUpdate(objective.id, patch)} onDelete={() => onDelete(objective.id)} />{/each}{#if objectives.length === 0}<p class="empty-copy">No objectives yet.</p>{/if}</div>
</section>
