<script>
  // @ts-nocheck
  import { GripVertical, ListTodo, Plus, Trash2 } from "@lucide/svelte";
  import { sortableDragHandle, sortableDropTarget } from "$lib/shared/actions/sortableDrag.js";
  import ReadonlyBadges from "$lib/shared/components/ReadonlyBadges.svelte";
  import DurationTotal from "$lib/shared/components/DurationTotal.svelte";
  import SuggestionDropdown from "$lib/shared/components/SuggestionDropdown.svelte";
  import { summarizeDurations } from "$lib/shared/utils/durationSummary.js";
  import { planSummary } from "../weeklyIndexParser.js";
  import PlanDetailsModal from "./PlanDetailsModal.svelte";

  let {
    plan,
    suggestions = [],
    collapsedDays = [],
    toggleDay,
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
  let gridTemplateColumns = $derived(days.map((day) => collapsedDays.includes(day) ? "56px" : "minmax(136px, 1fr)").join(" "));
  let totalDuration = $derived(summarizeDurations(
    plan.flatMap((entry) => entry.activities.map((activity) => activity.minutes))
  ));

  let editingSessionId = $state(null);
  let editingOriginalSession = $state("");
  let sessionNameEdited = $state(false);
  let showSessionSuggestions = $state(false);
  let highlightedSessionIndex = $state(-1);
  let selectedEntryId = $state(null);
  let draggedEntryId = $state(null);
  let dragOverEntryId = $state(null);
  let dragOverDay = $state(null);
  let dropPosition = $state("before");

  let selectedEntry = $derived(plan.find((entry) => entry.id === selectedEntryId));
  let editingEntry = $derived(plan.find((entry) => entry.id === editingSessionId));
  let filteredSessionSuggestions = $derived(suggestions.filter((suggestion) => {
    const query = sessionNameEdited ? (editingEntry?.session || "").trim().toLowerCase() : "";
    return suggestion.name.toLowerCase().includes(query);
  }));

  function focus(node) {
    node.focus();
  }

  function beginSessionEdit(entry) {
    editingOriginalSession = entry.session;
    editingSessionId = entry.id;
    sessionNameEdited = false;
    showSessionSuggestions = suggestions.length > 0;
    highlightedSessionIndex = -1;
  }

  function finishSessionEdit() {
    editingSessionId = null;
    editingOriginalSession = "";
    sessionNameEdited = false;
    showSessionSuggestions = false;
    highlightedSessionIndex = -1;
  }

  function selectSessionSuggestion(entry, suggestion) {
    onUpdate(entry.id, { session: suggestion.name });
    finishSessionEdit();
  }

  function handleSessionKeydown(event, entry) {
    if (event.key === "Enter") {
      if (showSessionSuggestions && highlightedSessionIndex >= 0 && highlightedSessionIndex < filteredSessionSuggestions.length) {
        event.preventDefault();
        selectSessionSuggestion(entry, filteredSessionSuggestions[highlightedSessionIndex]);
      } else {
        finishSessionEdit();
      }
    } else if (event.key === "Escape") {
      cancelSessionEdit(event, entry);
    } else if (event.key === "ArrowDown" && filteredSessionSuggestions.length > 0) {
      event.preventDefault();
      showSessionSuggestions = true;
      highlightedSessionIndex = (highlightedSessionIndex + 1) % filteredSessionSuggestions.length;
    } else if (event.key === "ArrowUp" && showSessionSuggestions && filteredSessionSuggestions.length > 0) {
      event.preventDefault();
      highlightedSessionIndex = (highlightedSessionIndex - 1 + filteredSessionSuggestions.length) % filteredSessionSuggestions.length;
    }
  }

  function cancelSessionEdit(event, entry) {
    event.preventDefault();
    event.stopPropagation();
    onUpdate(entry.id, { session: editingOriginalSession });
    finishSessionEdit();
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
    <DurationTotal label="Weekly planned total" summary={totalDuration} />
  </header>

  <div class="week-board" style:grid-template-columns={gridTemplateColumns}>
    {#each days as day}
      {@const entries = plan.filter((entry) => entry.day === day)}
      {#if entries.length === 0}
        <section class="day-column" class:collapsed={collapsedDays.includes(day)} aria-label={`${day} plan`}>
          <header class="day-header">
            <button type="button" onclick={() => toggleDay(day)} aria-expanded={!collapsedDays.includes(day)} aria-label={`${collapsedDays.includes(day) ? "Expand" : "Collapse"} ${day}`} disabled={!collapsedDays.includes(day) && collapsedDays.length === 6}>
              <span class="day-name">{day}</span><span>{entries.length}</span>
            </button>
          </header>

          {#if !collapsedDays.includes(day)}
          <div class="card-list empty">
            <div
              class="day-drop-target"
              use:sortableDropTarget={{
                id: dayTargetId(day),
                type: "weekly-plan",
                onOver: handleDayDragOver,
                onLeave: handleDayDragLeave,
                onDrop: handleDayDrop
              }}
            >
              {#if dragOverDay === day}
                <div class="day-drop-zone active" aria-hidden="true"></div>
              {:else}
                <p class="day-empty">No sessions</p>
              {/if}
            </div>
          </div>

          <button type="button" class="add-day-btn" onclick={() => onAdd(day)} title={`Add planned session to ${day}`}>
            <Plus size={13} /> Add
          </button>
          {/if}
        </section>
      {:else}
        <section class="day-column" class:collapsed={collapsedDays.includes(day)} aria-label={`${day} plan`}>
          <header class="day-header">
            <button type="button" onclick={() => toggleDay(day)} aria-expanded={!collapsedDays.includes(day)} aria-label={`${collapsedDays.includes(day) ? "Expand" : "Collapse"} ${day}`} disabled={!collapsedDays.includes(day) && collapsedDays.length === 6}>
              <span class="day-name">{day}</span><span>{entries.length}</span>
            </button>
          </header>

          {#if !collapsedDays.includes(day)}
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
                    <div class="session-edit-wrapper">
                      <input
                        class="session-input quiet-edit-input"
                        value={entry.session}
                        onblur={() => {
                          const blurredEntryId = entry.id;
                          setTimeout(() => { if (editingSessionId === blurredEntryId) finishSessionEdit(); }, 150);
                        }}
                        onkeydown={(event) => handleSessionKeydown(event, entry)}
                        oninput={(event) => {
                          sessionNameEdited = true;
                          showSessionSuggestions = true;
                          highlightedSessionIndex = -1;
                          onUpdate(entry.id, { session: event.currentTarget.value });
                        }}
                        placeholder="What session?"
                        use:focus
                        onclick={(event) => event.stopPropagation()}
                        autocomplete="off"
                        spellcheck="false"
                      />
                      {#if showSessionSuggestions && filteredSessionSuggestions.length > 0}
                        <SuggestionDropdown
                          suggestions={filteredSessionSuggestions}
                          highlightedIndex={highlightedSessionIndex}
                          onHighlight={(index) => highlightedSessionIndex = index}
                          onSelect={(suggestion) => selectSessionSuggestion(entry, suggestion)}
                          ariaLabel="Session suggestions"
                        />
                      {/if}
                    </div>
                  {:else}
                    <button type="button" class="session-title" onclick={() => beginSessionEdit(entry)} title={entry.session || "Unnamed session"}>
                      {entry.session || "Unnamed session"}
                    </button>
                  {/if}

                  {#if editingSessionId !== entry.id}
                    <button type="button" class="delete-btn" onpointerdown={(e) => e.preventDefault()} onclick={() => onDelete(entry.id)} aria-label="Delete plan entry" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  {/if}
                </div>

                <ReadonlyBadges subjects={summary.subjects} minutes={summary.targetMinutes} incomplete={summary.unknownDurationCount > 0} />

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
          {/if}
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
    gap: 8px;
    overflow: visible;
    padding-bottom: 2px;
  }
  .session-edit-wrapper { position: relative; flex: 1; min-width: 0; }
  .session-edit-wrapper .session-input { width: 100%; box-sizing: border-box; }
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

  .day-column.collapsed { min-height: 0; overflow: hidden; }

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
    padding: 7px;
  }

  .card-list.empty {
    position: relative;
    align-content: start;
    min-height: 0;
  }

  .day-drop-target {
    display: grid;
    place-items: center;
    width: min(100%, 158px);
    min-height: 76px;
    justify-self: center;
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
    width: 100%;
    height: 76px;
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
    transition: color 0.15s ease;
  }

  .drag-handle:hover {
    background: transparent;
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
    height: 26px;
    padding: 3px 6px;
    color: var(--text-color);
    font-size: var(--text-sm);
    font-weight: 650;
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
    background: transparent;
    color: #ff5555;
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
      overflow-x: auto;
    }
  }
</style>
