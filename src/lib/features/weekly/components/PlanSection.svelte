<script>
  // @ts-nocheck
  import { GripVertical, ListTodo, Plus, Trash2 } from "@lucide/svelte";
  import { sortableDragHandle, sortableDropTarget } from "$lib/shared/actions/sortableDrag.js";
  import ReadonlyBadges from "$lib/shared/components/ReadonlyBadges.svelte";
  import { planSummary } from "../weeklyIndexParser.js";
  import PlanDetailsModal from "./PlanDetailsModal.svelte";

  let {
    plan,
    onAdd,
    onUpdate,
    onDelete,
    onMove,
    onMoveToDay,
    onAddActivity,
    onUpdateActivity,
    onDeleteActivity,
    onMoveActivity
  } = $props();
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  let editingSessionId = $state(null);
  let selectedEntryId = $state(null);
  let draggedEntryId = $state(null);
  let dragOverEntryId = $state(null);
  let dragOverDay = $state(null);
  let dropPosition = $state("before");

  let selectedEntry = $derived(plan.find((entry) => entry.id === selectedEntryId));

  function focus(node) {
    node.focus();
  }

  function resetDrag() {
    draggedEntryId = null;
    dragOverEntryId = null;
    dragOverDay = null;
    dropPosition = "before";
  }

  function dragState(entryId) {
    return {
      dragging: draggedEntryId === entryId,
      over: dragOverEntryId === entryId && draggedEntryId !== entryId,
      position: dropPosition
    };
  }

  function handleDragStart({ id }) {
    draggedEntryId = id;
  }

  function handleDragOver({ id, position }) {
    if (!draggedEntryId || draggedEntryId === id) return;
    const source = plan.find((entry) => entry.id === draggedEntryId);
    const target = plan.find((entry) => entry.id === id);
    if (!source || !target) return;
    dragOverEntryId = id;
    dragOverDay = null;
    dropPosition = position;
  }

  function handleDragLeave({ id }) {
    if (dragOverEntryId === id) {
      dragOverEntryId = null;
      dropPosition = "before";
    }
  }

  function handleDrop({ sourceId, targetId, position }) {
    onMove?.(sourceId, targetId, position);
    resetDrag();
  }

  function dayTargetId(day) {
    return `day:${day}`;
  }

  function handleDayDragOver({ id }) {
    if (!draggedEntryId) return;
    const day = id.replace("day:", "");
    const source = plan.find((entry) => entry.id === draggedEntryId);
    if (!source || !days.includes(day)) return;
    dragOverEntryId = null;
    dragOverDay = day;
    dropPosition = "after";
  }

  function handleDayDragLeave({ id }) {
    const day = id.replace("day:", "");
    if (dragOverDay === day) {
      dragOverDay = null;
      dropPosition = "before";
    }
  }

  function handleDayDrop({ sourceId, targetId }) {
    const day = targetId.replace("day:", "");
    onMoveToDay?.(sourceId, day);
    resetDrag();
  }
</script>

<section id="plan" class="week-section">
  <header>
    <div><h2>Weekly plan</h2></div>
  </header>

  <div class="week-board">
    {#each days as day}
      {@const entries = plan.filter((entry) => entry.day === day)}
      {#if entries.length === 0}
        <section
          class="day-column"
          aria-label={`${day} plan`}
          use:sortableDropTarget={{
            id: dayTargetId(day),
            type: "weekly-plan",
            onOver: handleDayDragOver,
            onLeave: handleDayDragLeave,
            onDrop: handleDayDrop
          }}
        >
          <header class="day-header">
            <h3>{day}</h3>
            <span>{entries.length}</span>
          </header>

          <div class="card-list empty">
            {#if dragOverDay === day}
              <div class="day-drop-zone active" aria-hidden="true"></div>
            {:else}
              <p class="day-empty">No sessions</p>
            {/if}
          </div>

          <button type="button" class="add-day-btn" onclick={() => onAdd(day)} title={`Add planned session to ${day}`}>
            <Plus size={13} /> Add
          </button>
        </section>
      {:else}
        <section class="day-column" aria-label={`${day} plan`}>
        <header class="day-header">
          <h3>{day}</h3>
          <span>{entries.length}</span>
        </header>

          <div class="card-list">
          {#each entries as entry (entry.id)}
            {@const summary = planSummary(entry)}
            <article
              class="plan-card"
              class:dragging={dragState(entry.id).dragging}
              class:drop-before={dragState(entry.id).over && dragState(entry.id).position === "before"}
              class:drop-after={dragState(entry.id).over && dragState(entry.id).position === "after"}
              use:sortableDropTarget={{
                id: entry.id,
                type: "weekly-plan",
                onOver: handleDragOver,
                onLeave: handleDragLeave,
                onDrop: handleDrop
              }}
            >
              <div class="card-top">
                <span
                  role="button"
                  tabindex="0"
                  class="drag-handle"
                  aria-label={`Reorder ${entry.session}`}
                  title="Drag to reorder"
                  use:sortableDragHandle={{
                    id: entry.id,
                    type: "weekly-plan",
                    onStart: handleDragStart,
                    onEnd: resetDrag
                  }}
                >
                  <GripVertical size={13} />
                </span>
                {#if editingSessionId === entry.id}
                  <input
                    class="session-input"
                    value={entry.session}
                    onblur={() => editingSessionId = null}
                    onkeydown={(e) => { if (e.key === "Enter") editingSessionId = null; }}
                    oninput={(event) => onUpdate(entry.id, { session: event.currentTarget.value })}
                    placeholder="What session?"
                    use:focus
                    onclick={(event) => event.stopPropagation()}
                  />
                {:else}
                  <button type="button" class="session-title" onclick={() => editingSessionId = entry.id} title={entry.session || "Unnamed session"}>
                    {entry.session || "Unnamed session"}
                  </button>
                {/if}

                <button type="button" class="delete-btn" onpointerdown={(e) => e.preventDefault()} onclick={() => onDelete(entry.id)} aria-label="Delete plan entry" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>

              <ReadonlyBadges subjects={summary.subjects} minutes={summary.targetMinutes} />

              <button type="button" class="details-btn" onclick={() => selectedEntryId = entry.id} aria-label={`Open planned activities for ${entry.session}`} title="Open planned activities">
                <ListTodo size={13} />
                <span>{entry.activities?.length || 0} planned</span>
              </button>
            </article>
          {/each}
          </div>

        <button type="button" class="add-day-btn" onclick={() => onAdd(day)} title={`Add planned session to ${day}`}>
          <Plus size={13} /> Add
        </button>
      </section>
      {/if}
    {/each}
  </div>

  {#if selectedEntry}
    <PlanDetailsModal
      entry={selectedEntry}
      onClose={() => selectedEntryId = null}
      onAddActivity={() => onAddActivity(selectedEntry.id)}
      onUpdateActivity={(activityId, patch) => onUpdateActivity(selectedEntry.id, activityId, patch)}
      onDeleteActivity={(activityId) => onDeleteActivity(selectedEntry.id, activityId)}
      onMoveActivity={(activityId, direction) => onMoveActivity(selectedEntry.id, activityId, direction)}
    />
  {/if}
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
    padding: 7px;
  }

  .card-list.empty {
    position: relative;
    align-content: start;
  }

  .plan-card {
    position: relative;
    display: grid;
    gap: 7px;
    padding: 0 8px 8px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: #161916;
    overflow: visible;
  }

  .plan-card:hover {
    border-color: var(--border-color);
  }

  .plan-card.dragging {
    opacity: 0.58;
    border-color: var(--accent);
    background: #192016;
  }

  .plan-card.drop-before,
  .plan-card.drop-after {
    box-shadow: var(--shadow-sm);
  }

  .plan-card.drop-before::before,
  .plan-card.drop-after::after {
    content: "";
    position: absolute;
    left: -1px;
    right: -1px;
    height: 5px;
    border-color: var(--accent);
    border-style: solid;
    pointer-events: none;
    z-index: 2;
  }

  .plan-card.drop-before::before {
    top: -1px;
    border-width: 2px 1px 0;
    border-radius: 6px 6px 0 0;
  }

  .plan-card.drop-after::after {
    bottom: -1px;
    border-width: 0 1px 2px;
    border-radius: 0 0 6px 6px;
  }

  .day-drop-zone {
    width: min(100%, 158px);
    height: 76px;
    justify-self: center;
    border: 1px solid var(--accent);
    border-radius: 6px;
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    box-sizing: border-box;
  }

  .card-top {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 34px;
    margin: 0 -8px;
    padding: 0 6px;
    border-radius: 6px 6px 0 0;
    background: transparent;
    min-width: 0;
  }

  .drag-handle {
    display: inline-grid;
    place-items: center;
    flex: 0 0 24px;
    width: 24px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: grab;
    user-select: none;
  }

  .drag-handle:hover {
    background: var(--surface-hover);
    color: var(--text-color);
  }

  .drag-handle:active {
    cursor: grabbing;
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

  .details-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 26px;
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-size: var(--text-xs);
    cursor: pointer;
  }

  .details-btn:hover {
    background: var(--surface-hover);
    color: var(--text-color);
    border-color: var(--border-color);
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
    margin-top: auto;
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
