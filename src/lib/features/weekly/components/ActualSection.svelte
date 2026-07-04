<script>
  // @ts-nocheck
  import { RefreshCw } from "@lucide/svelte";
  import ReadonlyBadges from "$lib/shared/components/ReadonlyBadges.svelte";

  let { actual, onRefresh } = $props();
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
</script>

<section id="actual" class="week-section">
  <header>
    <div><h2>Weekly actual</h2></div>
    <button type="button" class="refresh-btn" onclick={onRefresh} title="Refresh actual logs">
      <RefreshCw size={12} /> Refresh
    </button>
  </header>

  <div class="week-board">
    {#each days as day}
      {@const entries = actual.filter((entry) => entry.day === day)}
      <section class="day-column" aria-label={`${day} actual`}>
        <header class="day-header">
          <h3>{day}</h3>
          <span>{entries.length}</span>
        </header>

        <div class="card-list">
          {#each entries as entry}
            <article class="actual-card">
              <div class="card-top">
                <strong>{entry.session || "Unnamed session"}</strong>
              </div>

              <ReadonlyBadges subjects={entry.subjects} minutes={entry.actualMinutes} />
            </article>
          {/each}

          {#if entries.length === 0}
            <p class="day-empty">No records</p>
          {/if}
        </div>
      </section>
    {/each}
  </div>
</section>

<style>
  .week-board {
    display: grid;
    grid-template-columns: repeat(7, minmax(136px, 1fr));
    gap: 8px;
    overflow-x: hidden;
    padding-bottom: 2px;
  }

  .day-column {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 180px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--surface);
    overflow: hidden;
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

  .actual-card {
    display: grid;
    gap: 7px;
    padding: 8px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: #161916;
  }

  .actual-card:hover {
    border-color: var(--border-subtle);
  }

  .card-top {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .card-top strong {
    min-width: 0;
    overflow: hidden;
    color: var(--text-color);
    font-size: var(--text-sm);
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .day-empty {
    margin: 4px 0;
    color: var(--text-muted);
    font-size: var(--text-xs);
    font-style: italic;
  }

  .refresh-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: 28px;
    padding: 0 12px;
    border: 1px solid var(--border-color);
    border-radius: 5px;
    background: var(--surface-2);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .refresh-btn:hover {
    background: var(--surface-hover);
    color: var(--text-color);
    border-color: var(--border-strong);
  }

  @media (max-width: 900px) {
    .week-board {
      grid-template-columns: repeat(7, 150px);
      overflow-x: auto;
    }
  }
</style>
