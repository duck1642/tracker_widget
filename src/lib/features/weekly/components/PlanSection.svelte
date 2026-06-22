<script>
  // @ts-nocheck
  import { Plus, Trash2 } from "@lucide/svelte";
  import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
  import TimeInput from "$lib/shared/components/TimeInput.svelte";
  let { plan, onAdd, onUpdate, onDelete } = $props();
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
</script>

<section id="plan" class="week-section">
  <header><div><span class="section-index">02</span><h2>Weekly plan</h2></div><button class="primary-small" onclick={() => onAdd("Mon")}><Plus size={14} /> Add session</button></header>
  <div class="plan-list">
    {#each days as day}
      {@const entries = plan.filter((entry) => entry.day === day)}
      {#if entries.length}
        <div class="day-group"><strong>{day}</strong><div>{#each entries as entry (entry.id)}<article><select value={entry.day} onchange={(event) => onUpdate(entry.id, { day: event.currentTarget.value })}>{#each days as option}<option value={option}>{option}</option>{/each}</select><label><span>Session</span><input value={entry.session} oninput={(event) => onUpdate(entry.id, { session: event.currentTarget.value })} /></label><SubjectInput subjects={entry.subjects} onChange={(subjects) => onUpdate(entry.id, { subjects })} /><TimeInput minutes={entry.targetMinutes} onChange={(targetMinutes) => onUpdate(entry.id, { targetMinutes })} /><button class="icon-button danger" onclick={() => onDelete(entry.id)} aria-label="Delete plan entry"><Trash2 size={15} /></button></article>{/each}</div></div>
      {/if}
    {/each}
    {#if plan.length === 0}<p class="empty-copy">No planned sessions yet.</p>{/if}
  </div>
</section>

<style>
  .plan-list { display: grid; gap: 12px; }
  .day-group { display: grid; grid-template-columns: 54px 1fr; border-top: 1px solid var(--border-subtle); padding-top: 8px; }
  .day-group > strong { color: var(--accent); padding: 11px 0; }
  article { display: grid; grid-template-columns: 76px minmax(140px, .8fr) minmax(160px, 1fr) 86px 32px; gap: 9px; align-items: end; padding: 7px 0; }
  label { display: grid; gap: 4px; } label span { color: var(--text-muted); font-size: var(--text-xs); }
  @media (max-width: 760px) { .day-group { grid-template-columns: 1fr; } article { grid-template-columns: 76px 1fr 86px 32px; } article :global(label:nth-of-type(2)) { grid-column: 1 / -1; } }
</style>
