<script>
  // @ts-nocheck
  import { Trash2 } from "@lucide/svelte";
  import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
  let { objective, onUpdate, onDelete } = $props();
</script>

<article>
  <label class="description"><span>Objective</span><input value={objective.description} oninput={(event) => onUpdate({ description: event.currentTarget.value.replace(/[\r\n]/g, " ") })} placeholder="Objective description" /></label>
  <SubjectInput subjects={objective.subjects} onChange={(subjects) => onUpdate({ subjects })} />
  <label><span>Origin</span><select value={objective.origin} onchange={(event) => onUpdate({ origin: event.currentTarget.value })}><option value="planned">Planned</option><option value="unplanned">Unplanned</option></select></label>
  <label><span>Status</span><select class={`status ${objective.status}`} value={objective.status} onchange={(event) => onUpdate({ status: event.currentTarget.value })}><option value="open">Open</option><option value="done">Done</option><option value="partial">Partial</option><option value="cancelled">Cancelled</option></select></label>
  <button class="icon-button danger" onclick={onDelete} aria-label="Delete objective"><Trash2 size={15} /></button>
</article>

<style>
  article { display: grid; grid-template-columns: minmax(220px, 1.4fr) minmax(140px, .8fr) 115px 115px 32px; align-items: end; gap: 9px; padding: 10px 0; border-bottom: 1px solid var(--border-subtle); }
  label { display: grid; gap: 4px; min-width: 0; }
  span { color: var(--text-muted); font-size: var(--text-xs); }
  input, select { width: 100%; box-sizing: border-box; }
  .done { color: var(--success); } .partial { color: var(--warning); } .cancelled { color: var(--danger); }
  @media (max-width: 820px) { article { grid-template-columns: 1fr 1fr 1fr 32px; } .description { grid-column: 1 / -1; grid-row: 1; } }
</style>

