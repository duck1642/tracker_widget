<script>
  // @ts-nocheck
  import { RefreshCw } from "@lucide/svelte";
  import DurationTotal from "$lib/shared/components/DurationTotal.svelte";
  import ReadonlyBadges from "$lib/shared/components/ReadonlyBadges.svelte";
  import ActualDetailsModal from "./ActualDetailsModal.svelte";

  let { actual, onRefresh, collapsedDays = [], toggleDay } = $props();
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let gridTemplateColumns = $derived(days.map((day) => collapsedDays.includes(day) ? "56px" : "minmax(136px, 1fr)").join(" "));
  let totalDuration = $derived(actual.reduce((summary, entry) => ({
    knownMinutes: summary.knownMinutes + (Number(entry.actualMinutes) || 0),
    unknownCount: summary.unknownCount + (Number(entry.unknownDurationCount) || 0)
  }), { knownMinutes: 0, unknownCount: 0 }));
  let selectedActual = $state(null);
</script>

<section id="actual" class="week-section">
  <header>
    <div><h2>Weekly actual</h2></div>
    <div class="header-actions">
      <DurationTotal label="Weekly actual total" summary={totalDuration} />
      <button type="button" class="refresh-btn" onclick={onRefresh} title="Refresh actual logs">
        <RefreshCw size={12} /> Refresh
      </button>
    </div>
  </header>

  <div class="week-board" style:grid-template-columns={gridTemplateColumns}>
    {#each days as day}
      {@const entries = actual.filter((entry) => entry.day === day)}
      <section class="day-column" class:collapsed={collapsedDays.includes(day)} aria-label={`${day} actual`}>
        <header class="day-header">
          <button type="button" onclick={() => toggleDay(day)} aria-expanded={!collapsedDays.includes(day)} aria-label={`${collapsedDays.includes(day) ? "Expand" : "Collapse"} ${day}`} disabled={!collapsedDays.includes(day) && collapsedDays.length === 6}>
            <span class="day-name">{day}</span><span>{entries.length}</span>
          </button>
        </header>

        {#if !collapsedDays.includes(day)}
        <div class="card-list">
          {#each entries as entry}
            <button
              type="button"
              class="actual-card"
              onclick={() => selectedActual = entry}
              aria-label={`Open actual activities for ${entry.session || "Unnamed session"}`}
            >
              <div class="card-top">
                <strong title={entry.session || "Unnamed session"}>{entry.session || "Unnamed session"}</strong>
              </div>

              <ReadonlyBadges subjects={entry.subjects} minutes={entry.actualMinutes} incomplete={entry.unknownDurationCount > 0} />
            </button>
          {/each}

          {#if entries.length === 0}
            <p class="day-empty">No records</p>
          {/if}
        </div>
        {/if}
      </section>
    {/each}
  </div>

  {#if selectedActual}
    <ActualDetailsModal entry={selectedActual} onClose={() => selectedActual = null} />
  {/if}
</section>

<style>
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .week-board {
    display: grid;
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

  .day-column.collapsed { min-height: 0; }

  .day-header {
    min-height: 38px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-2);
  }

  .day-column.collapsed .day-header { border-bottom: 0; }

  .day-header button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 38px;
    padding: 0 9px;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .day-header button:focus-visible { outline: 1px solid var(--accent); outline-offset: -2px; }
  .day-header button:disabled { cursor: default; }

  .day-name {
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
    width: 100%;
    padding: 8px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: #161916;
    text-align: left;
    cursor: pointer;
  }

  .actual-card:hover,
  .actual-card:focus-visible {
    border-color: var(--border-subtle);
  }

  .actual-card:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: 2px;
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
      overflow-x: auto;
    }
  }
</style>
