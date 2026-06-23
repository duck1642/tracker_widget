<script>
  // @ts-nocheck
  import { Plus, Trash2 } from "@lucide/svelte";
  import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
  import TimeInput from "$lib/shared/components/TimeInput.svelte";
  let { plan, onAdd, onUpdate, onDelete } = $props();
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
</script>

<section id="plan" class="week-section">
  <header>
    <div><h2>Weekly plan</h2></div>
  </header>
  <div class="plan-list">
    {#each days as day}
      {@const entries = plan.filter((entry) => entry.day === day)}
      <div class="day-group">
        <div class="day-header">
          <strong>{day}</strong>
          <button type="button" class="add-inline-btn" onclick={() => onAdd(day)} title="Add session to {day}">
            <Plus size={12} /> Add
          </button>
        </div>
        <div class="day-entries">
          {#each entries as entry (entry.id)}
            <article>
              <label>
                <span>Session</span>
                <input value={entry.session} oninput={(event) => onUpdate(entry.id, { session: event.currentTarget.value })} />
              </label>
              <SubjectInput subjects={entry.subjects} onChange={(subjects) => onUpdate(entry.id, { subjects })} />
              <TimeInput minutes={entry.targetMinutes} onChange={(targetMinutes) => onUpdate(entry.id, { targetMinutes })} />
              <button type="button" class="icon-button danger" onpointerdown={(e) => e.preventDefault()} onclick={() => onDelete(entry.id)} aria-label="Delete plan entry" title="Delete">
                <Trash2 size={15} />
              </button>
            </article>
          {/each}
          {#if entries.length === 0}
            <div class="day-empty">No sessions planned</div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .plan-list { display: grid; gap: 8px; }
  .day-group { display: grid; grid-template-columns: 80px 1fr; border-top: 1px solid var(--border-subtle); padding: 10px 0; }
  .day-group:first-of-type { border-top: none; }
  .day-header { display: flex; flex-direction: column; gap: 6px; align-items: start; padding-top: 4px; }
  .day-header > strong { color: var(--accent); font-size: var(--text-sm); font-weight: 700; }
  .add-inline-btn { display: inline-flex; align-items: center; justify-content: center; gap: 3px; height: 22px; padding: 0 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--surface-2); color: var(--text-muted); font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
  .add-inline-btn:hover { background: var(--surface-hover); color: var(--text-color); border-color: var(--border-strong); }
  .day-entries { display: grid; gap: 8px; }
  .day-empty { display: flex; align-items: center; min-height: 28px; padding-left: 4px; color: var(--text-muted); font-size: var(--text-xs); font-style: italic; }
  article { display: grid; grid-template-columns: minmax(130px, 0.8fr) minmax(150px, 1fr) 86px 32px; gap: 12px; align-items: end; padding: 2px 0; }
  label { display: grid; gap: 4px; } label span { color: var(--text-muted); font-size: var(--text-xs); }
  @media (max-width: 760px) {
    .day-group { grid-template-columns: 1fr; gap: 8px; }
    .day-header { flex-direction: row; justify-content: space-between; align-items: center; padding-top: 0; border-bottom: 1px solid var(--border-subtle); padding-bottom: 4px; }
    article { grid-template-columns: 1fr 86px 32px; }
    article :global(label:nth-of-type(2)) { grid-column: 1 / -1; }
  }
</style>
