<script>
  // @ts-nocheck
  import { Plus, Trash2 } from "@lucide/svelte";
  import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
  import TimeInput from "$lib/shared/components/TimeInput.svelte";
  let { plan, onAdd, onUpdate, onDelete } = $props();
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  let editingSessionId = $state(null);
  function focus(node) {
    node.focus();
  }
</script>

<section id="plan" class="week-section">
  <header>
    <div><h2>Weekly plan</h2></div>
  </header>
  <div class="plan-list">
    {#each days as day}
      {@const entries = plan.filter((entry) => entry.day === day)}
      <div class="day-group">
        <div class="day-title">
          <strong>{day}</strong>
        </div>
        <div class="day-entries">
          {#each entries as entry (entry.id)}
            <div class="plan-card">
              <div class="card-top">
                {#if editingSessionId === entry.id}
                  <input
                    class="session-input"
                    value={entry.session}
                    onblur={() => editingSessionId = null}
                    onkeydown={(e) => { if (e.key === "Enter") editingSessionId = null; }}
                    oninput={(event) => onUpdate(entry.id, { session: event.currentTarget.value })}
                    placeholder="What session?"
                    use:focus
                  />
                {:else}
                  <span class="session-text" onclick={() => editingSessionId = entry.id}>
                    {entry.session || "Unnamed session"}
                  </span>
                {/if}
                <button type="button" class="row-btn del" onpointerdown={(e) => e.preventDefault()} onclick={() => onDelete(entry.id)} aria-label="Delete plan entry" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
              <div class="card-bottom">
                <SubjectInput subjects={entry.subjects} onChange={(subjects) => onUpdate(entry.id, { subjects })} variant="badge" />
                <TimeInput minutes={entry.targetMinutes} onChange={(targetMinutes) => onUpdate(entry.id, { targetMinutes })} variant="badge" />
              </div>
            </div>
          {/each}
          {#if entries.length === 0}
            <div class="day-empty">No sessions planned</div>
          {/if}
          <div class="actions-footer">
            <button type="button" class="add-inline-btn" onclick={() => onAdd(day)} title="Add session to {day}">
              <Plus size={12} /> Add session
            </button>
          </div>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .plan-list { display: flex; flex-direction: column; gap: 8px; }
  .day-group { display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--border-subtle); padding: 16px 0; }
  .day-group:first-of-type { border-top: none; padding-top: 0; }
  .day-title { display: flex; align-items: center; height: 28px; }
  .day-title > strong { color: var(--accent); font-size: var(--text-md); font-weight: 700; }
  .day-entries { display: flex; flex-direction: column; }
  .plan-card { display: flex; flex-direction: column; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--border-subtle); }
  .day-entries :global(.plan-card:last-of-type) { border-bottom: none; }
  .card-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .session-text { flex: 1; font-size: var(--text-sm); color: var(--text-color); cursor: pointer; min-height: 24px; display: flex; align-items: center; }
  .session-input { flex: 1; background: transparent; border: none; border-bottom: 1px dashed var(--border-strong); color: var(--text-color); font-size: var(--text-sm); outline: none; padding: 2px 0; }
  .card-bottom { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .row-btn { background: transparent; border: none; border-radius: 4px; width: 22px; height: 22px; display: grid; place-items: center; color: var(--text-muted); cursor: pointer; transition: all 0.15s ease; }
  .row-btn:hover { background: var(--surface-hover); color: var(--text-color); }
  .row-btn.del:hover { background: rgba(255, 136, 136, 0.1); color: #ff8888; }
  .add-inline-btn { display: inline-flex; align-items: center; justify-content: center; gap: 3px; height: 22px; padding: 0 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--surface-2); color: var(--text-muted); font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
  .add-inline-btn:hover { background: var(--surface-hover); color: var(--text-color); border-color: var(--border-strong); }
  .actions-footer { display: flex; justify-content: flex-start; padding-top: 8px; }
  .day-empty { display: flex; align-items: center; min-height: 28px; padding-left: 4px; color: var(--text-muted); font-size: var(--text-xs); font-style: italic; }
</style>
