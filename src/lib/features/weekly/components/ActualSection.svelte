<script>
  // @ts-nocheck
  import { RefreshCw } from "@lucide/svelte";
  let { actual, sessionColWidth = 140, onStartResize, onRefresh } = $props();

  const dayOrder = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  let sortedActual = $derived([...actual].sort((a, b) => dayOrder[a.day] - dayOrder[b.day]));
</script>

<section id="actual" class="week-section" style="--session-width: {sessionColWidth}px">
  <header>
    <div><h2>Weekly actual</h2></div>
    <button type="button" class="refresh-btn" onclick={onRefresh} title="Refresh actual logs">
      <RefreshCw size={12} /> Refresh
    </button>
  </header>

  <div class="actual-grid">
    <div class="table-head">
      <span>Day</span>
      <span class="session-head">
        Session
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="resize-handle" onpointerdown={onStartResize} title="Drag to resize column"></div>
      </span>
      <span>Subjects</span>
      <span>Minutes</span>
      <span></span>
    </div>

    {#each sortedActual as entry}
      <div class="actual-row">
        <!-- Day Column -->
        <div class="day-col">
          <div class="day-badge">
            {entry.day}
          </div>
        </div>

        <!-- Session Column -->
        <div class="session-col">
          <span class="session-text">
            {entry.session || "Unnamed session"}
          </span>
        </div>

        <!-- Subjects Column -->
        <div class="subjects-col">
          <div class="subject-badges">
            {#each entry.subjects as subject}
              <div class="subject-badge">{subject}</div>
            {/each}
            {#if entry.subjects.length === 0}
              <div class="subject-badge placeholder">-</div>
            {/if}
          </div>
        </div>

        <!-- Minutes Column -->
        <div class="time-col">
          <div class="time-badge">
            {entry.actualMinutes}m
          </div>
        </div>

        <!-- Empty Action Column to align with Planned Table -->
        <div class="action-col"></div>
      </div>
    {/each}

    {#if actual.length === 0}
      <div class="empty-copy">No recorded sessions.</div>
    {/if}
  </div>
</section>

<style>
  .actual-grid { border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; background: var(--surface); }

  .table-head {
    display: grid;
    grid-template-columns: 70px var(--session-width, 140px) minmax(150px, 1.4fr) 90px 32px;
    gap: 12px;
    align-items: center;
    min-height: 38px;
    padding: 0 12px;
    background: var(--surface-2);
    color: var(--text-muted);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    border-bottom: 1px solid var(--border-color);
  }

  .actual-row {
    display: grid;
    grid-template-columns: 70px var(--session-width, 140px) minmax(150px, 1.4fr) 90px 32px;
    gap: 12px;
    align-items: center;
    padding: 6px 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .actual-grid :global(.actual-row:first-of-type) {
    border-top: none;
  }

  .session-head {
    position: relative;
    display: flex;
    align-items: center;
    align-self: stretch;
    height: 100%;
  }
  .resize-handle {
    position: absolute;
    right: -6px;
    top: 0;
    bottom: 0;
    width: 12px;
    cursor: col-resize;
    z-index: 10;
    background: transparent;
  }
  .resize-handle::after {
    content: "";
    position: absolute;
    left: 5px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: transparent;
    transition: background 0.15s ease;
  }
  .resize-handle:hover::after {
    background: var(--border-strong);
  }

  .day-col { display: flex; align-items: center; }
  .day-badge {
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0 8px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    box-sizing: border-box;
  }

  .session-col { display: flex; align-items: center; min-width: 0; }
  .session-text { flex: 1; font-size: var(--text-sm); color: var(--text-color); min-height: 24px; display: flex; align-items: center; }

  .subjects-col { display: flex; align-items: center; min-width: 0; }
  .subject-badges { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .subject-badge {
    background: #121212;
    color: #b3b3b3;
    border: 1px solid #2d2d2d;
    border-radius: 4px;
    padding: 0 8px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    box-sizing: border-box;
  }
  .subject-badge.placeholder {
    color: var(--text-muted);
    border-style: dashed;
    background: transparent;
  }

  .time-col { display: flex; align-items: center; }
  .time-badge {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid #3d3d3d;
    border-radius: 4px;
    padding: 0 8px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    box-sizing: border-box;
  }

  .action-col { display: flex; align-items: center; justify-content: flex-end; }

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

  .empty-copy {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 50px;
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-style: italic;
  }
</style>
