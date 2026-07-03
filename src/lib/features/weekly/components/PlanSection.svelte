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

  <div class="week-board">
    {#each days as day}
      {@const entries = plan.filter((entry) => entry.day === day)}
      <section class="day-column" aria-label={`${day} plan`}>
        <header class="day-header">
          <h3>{day}</h3>
          <span>{entries.length}</span>
        </header>

        <div class="card-list">
          {#each entries as entry (entry.id)}
            <article class="plan-card">
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
                  <button type="button" class="session-title" onclick={() => editingSessionId = entry.id}>
                    {entry.session || "Unnamed session"}
                  </button>
                {/if}

                <button type="button" class="delete-btn" onpointerdown={(e) => e.preventDefault()} onclick={() => onDelete(entry.id)} aria-label="Delete plan entry" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>

              <div class="card-field">
                <span>Time</span>
                <TimeInput minutes={entry.targetMinutes} onChange={(targetMinutes) => onUpdate(entry.id, { targetMinutes })} variant="badge" />
              </div>

              <div class="card-field">
                <span>Subjects</span>
                <SubjectInput subjects={entry.subjects} onChange={(subjects) => onUpdate(entry.id, { subjects })} variant="badge" />
              </div>
            </article>
          {/each}

          {#if entries.length === 0}
            <p class="day-empty">No sessions</p>
          {/if}
        </div>

        <button type="button" class="add-day-btn" onclick={() => onAdd(day)} title={`Add planned session to ${day}`}>
          <Plus size={13} /> Add
        </button>
      </section>
    {/each}
  </div>
</section>

<style>
  .week-board {
    display: grid;
    grid-template-columns: repeat(7, minmax(136px, 1fr));
    gap: 8px;
    overflow: visible;
    padding-bottom: 2px;
  }

  .day-column {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 220px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--surface);
    overflow: visible;
  }

  .day-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 38px;
    padding: 0 9px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-2);
  }

  h3 {
    margin: 0;
    color: var(--accent);
    font-size: var(--text-sm);
    font-weight: 750;
  }

  .day-header span {
    color: var(--text-muted);
    font-size: var(--text-xs);
  }

  .card-list {
    display: grid;
    align-content: start;
    gap: 7px;
    flex: 1;
    padding: 7px;
  }

  .plan-card {
    display: grid;
    gap: 7px;
    padding: 8px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: #161916;
  }

  .plan-card:hover {
    border-color: var(--border-subtle);
  }

  .card-top {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .session-title {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-color);
    font-size: var(--text-sm);
    font-weight: 650;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-title:hover {
    color: var(--accent);
  }

  .session-input {
    flex: 1;
    min-width: 0;
    height: 24px;
    padding: 0;
    border: 0;
    border-bottom: 1px dashed var(--border-strong);
    border-radius: 0;
    background: transparent;
    color: var(--text-color);
    font-size: var(--text-sm);
    font-weight: 650;
    outline: none;
  }

  .session-input:focus,
  .session-input:focus-visible {
    border: 0;
    border-bottom: 1px dashed var(--accent);
    box-shadow: none;
    outline: none;
  }

  .delete-btn {
    display: grid;
    place-items: center;
    flex: 0 0 20px;
    width: 20px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .delete-btn:hover {
    background: rgba(255, 136, 136, 0.1);
    color: #ff8888;
  }

  .card-field {
    display: grid;
    gap: 4px;
  }

  .card-field > span {
    color: var(--text-muted);
    font-size: 9px;
    font-weight: 750;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .day-empty {
    margin: 4px 0;
    color: var(--text-muted);
    font-size: var(--text-xs);
    font-style: italic;
  }

  .add-day-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    min-height: 32px;
    padding: 0 9px;
    border: 0;
    border-top: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--accent);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .add-day-btn:hover {
    background: var(--surface-hover);
    color: var(--text-color);
  }

  @media (max-width: 900px) {
    .week-board {
      grid-template-columns: repeat(7, 150px);
      overflow-x: auto;
    }
  }
</style>
