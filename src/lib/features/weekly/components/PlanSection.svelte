<script>
  // @ts-nocheck
  import { Plus, Trash2 } from "@lucide/svelte";
  import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
  import TimeInput from "$lib/shared/components/TimeInput.svelte";
  let { plan, sessionColWidth = 140, onStartResize, onAdd, onUpdate, onDelete } = $props();
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  let editingSessionId = $state(null);
  let showDayDropdownId = $state(null);

  function focus(node) {
    node.focus();
  }

  // Close dropdown on click outside
  if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", (e) => {
      if (!e.target.closest(".day-dropdown-container")) {
        showDayDropdownId = null;
      }
    });
  }

  const dayOrder = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  let sortedPlan = $derived([...plan].sort((a, b) => dayOrder[a.day] - dayOrder[b.day]));

  function handleAdd() {
    const lastEntry = plan[plan.length - 1];
    const defaultDay = lastEntry ? lastEntry.day : "Mon";
    onAdd(defaultDay);
  }
</script>

<section id="plan" class="week-section" style="--session-width: {sessionColWidth}px">
  <header>
    <div><h2>Weekly plan</h2></div>
  </header>
  
  <div class="plan-grid">
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
    
    {#each sortedPlan as entry (entry.id)}
      <div class="plan-row">
        <!-- Day Selector Column -->
        <div class="day-col">
          <div class="day-dropdown-container">
            <button type="button" class="day-badge" onclick={() => showDayDropdownId = entry.id}>
              {entry.day}
            </button>
            {#if showDayDropdownId === entry.id}
              <div class="day-menu" role="menu">
                {#each days as d}
                  <button type="button" class="day-menu-item" onclick={() => { onUpdate(entry.id, { day: d }); showDayDropdownId = null; }}>
                    {d}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
        
        <!-- Session Column -->
        <div class="session-col">
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
        </div>
        
        <!-- Subjects Column -->
        <div class="subjects-col">
          <SubjectInput subjects={entry.subjects} onChange={(subjects) => onUpdate(entry.id, { subjects })} variant="badge" />
        </div>
        
        <!-- Minutes Column -->
        <div class="time-col">
          <TimeInput minutes={entry.targetMinutes} onChange={(targetMinutes) => onUpdate(entry.id, { targetMinutes })} variant="badge" />
        </div>
        
        <!-- Action Column -->
        <div class="action-col">
          <button type="button" class="row-btn del" onpointerdown={(e) => e.preventDefault()} onclick={() => onDelete(entry.id)} aria-label="Delete plan entry" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    {/each}
    
    {#if plan.length === 0}
      <div class="day-empty">No sessions planned.</div>
    {/if}
    
    <div class="actions-footer">
      <button type="button" class="add-activity-btn" onclick={handleAdd} title="Add planned session">
        <Plus size={14} /> Add planned session
      </button>
    </div>
  </div>
</section>

<style>
  .plan-grid { border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: visible; background: var(--surface); }
  
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
    border-top-left-radius: var(--radius-md);
    border-top-right-radius: var(--radius-md);
    border-bottom: 1px solid var(--border-color);
  }
  
  .plan-row {
    display: grid;
    grid-template-columns: 70px var(--session-width, 140px) minmax(150px, 1.4fr) 90px 32px;
    gap: 12px;
    align-items: center;
    padding: 6px 12px;
    border-top: 1px solid var(--border-subtle);
  }
  
  .plan-grid :global(.plan-row:first-of-type) {
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
  .session-col { display: flex; align-items: center; min-width: 0; }
  .session-text { flex: 1; font-size: var(--text-sm); color: var(--text-color); cursor: pointer; min-height: 24px; display: flex; align-items: center; }
  .session-input { flex: 1; background: transparent; border: none; border-bottom: 1px dashed var(--border-strong); color: var(--text-color); font-size: var(--text-sm); outline: none; padding: 2px 0; }
  
  .subjects-col { display: flex; align-items: center; min-width: 0; }
  .time-col { display: flex; align-items: center; }
  .action-col { display: flex; align-items: center; justify-content: flex-end; }
  
  /* Day Dropdown styling */
  .day-dropdown-container {
    position: relative;
    display: inline-flex;
  }
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
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .day-badge:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  
  .day-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    width: 80px;
    padding: 4px;
    border: 1px solid #333333;
    border-radius: 6px;
    background: #181818;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    box-sizing: border-box;
  }
  .day-menu-item {
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    height: 26px;
    width: 100%;
    box-sizing: border-box;
    transition: all 0.1s ease;
  }
  .day-menu-item:hover {
    background: var(--surface-hover);
    color: var(--text-color);
  }
  
  .row-btn { background: transparent; border: none; border-radius: 4px; width: 22px; height: 22px; display: grid; place-items: center; color: var(--text-muted); cursor: pointer; transition: all 0.15s ease; }
  .row-btn:hover { background: var(--surface-hover); color: var(--text-color); }
  .row-btn.del:hover { background: rgba(255, 136, 136, 0.1); color: #ff8888; }
  
  .add-activity-btn { display: flex; align-items: center; gap: 6px; min-height: 30px; border: 0; background: transparent; color: var(--accent); cursor: pointer; font-size: var(--text-sm); font-weight: 500; padding: 0; transition: color 0.15s ease; }
  .add-activity-btn:hover { color: var(--text-color); }
  .actions-footer { display: flex; justify-content: flex-start; padding: 8px 12px; border-top: 1px solid var(--border-subtle); background: var(--surface); border-bottom-left-radius: var(--radius-md); border-bottom-right-radius: var(--radius-md); }
  .day-empty { display: flex; align-items: center; justify-content: center; min-height: 50px; color: var(--text-muted); font-size: var(--text-sm); font-style: italic; }
</style>
