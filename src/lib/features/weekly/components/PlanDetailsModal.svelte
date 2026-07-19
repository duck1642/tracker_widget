<script>
  // @ts-nocheck
  import { ChevronDown, ChevronUp, ClipboardPaste, Copy, Plus, Scissors, TextSelect, Trash2, X } from "@lucide/svelte";
  import { appStore } from "$lib/app/appStore.svelte.js";
  import ContextMenu from "$lib/shared/components/ContextMenu.svelte";
  import { captureEditableText, copyEditableSelection, cutEditableSelection, hasEditableSelection, pasteIntoEditable, selectAllEditableText } from "$lib/shared/services/editableTextClipboard.js";
  import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
  import TimeInput from "$lib/shared/components/TimeInput.svelte";
  import { planSummary } from "../weeklyIndexParser.js";

  let {
    entry,
    onClose,
    onAddActivity,
    onUpdateActivity,
    onDeleteActivity,
    onMoveActivity
  } = $props();

  let editingActivityId = $state(null);
  let contextMenu = $state(null);
  let summary = $derived(planSummary(entry));
  let contextActivityIndex = $derived(contextMenu ? (entry.activities || []).findIndex((activity) => activity.id === contextMenu.activityId) : -1);
  let contextMenuItems = $derived.by(() => {
    if (!contextMenu) return [];
    const activityId = contextMenu.activityId;
    const editable = contextMenu.editable;
    return [
      ...(editable ? [
        { label: "Cut", icon: Scissors, disabled: !hasEditableSelection(editable), onclick: () => runTextAction(cutEditableSelection, editable) },
        { label: "Copy", icon: Copy, disabled: !hasEditableSelection(editable), onclick: () => runTextAction(copyEditableSelection, editable) },
        { label: "Paste", icon: ClipboardPaste, onclick: () => runTextAction(pasteIntoEditable, editable) },
        { label: "Select All", icon: TextSelect, disabled: !editable.target.value, onclick: () => runTextAction(selectAllEditableText, editable) },
        { separator: true }
      ] : []),
      { label: "Move Up", icon: ChevronUp, disabled: contextActivityIndex <= 0, onclick: () => runEntityAction(onMoveActivity, activityId, "up") },
      { label: "Move Down", icon: ChevronDown, disabled: contextActivityIndex < 0 || contextActivityIndex >= (entry.activities || []).length - 1, onclick: () => runEntityAction(onMoveActivity, activityId, "down") },
      { separator: true },
      { label: "Delete", icon: Trash2, danger: true, onclick: () => runEntityAction(onDeleteActivity, activityId) }
    ];
  });

  function focus(node) {
    node.focus();
  }

  function openContextMenu(event, activityId) {
    event.preventDefault();
    contextMenu = { activityId, x: event.clientX, y: event.clientY, editable: captureEditableText(event.target) };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function runEntityAction(action, ...args) {
    closeContextMenu();
    action(...args);
  }

  async function runTextAction(action, editable) {
    closeContextMenu();
    try {
      await action(editable);
    } catch (error) {
      appStore.showStatus(`Clipboard failed: ${error}`);
    }
  }
</script>

<svelte:window
  onpointerdown={(event) => {
    if (!contextMenu) return;
    if (event.target instanceof Element && event.target.closest(".todo-context-menu")) return;
    closeContextMenu();
  }}
  onkeydown={(event) => {
    if (event.key !== "Escape") return;
    if (contextMenu) {
      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();
    } else {
      onClose();
    }
  }}
  onscrollcapture={closeContextMenu}
  onwheel={closeContextMenu}
/>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-backdrop" style="overflow-y: auto" role="presentation" onclick={onClose}>
  <div
    class="plan-modal"
    style="overflow: visible"
    role="dialog"
    aria-modal="true"
    aria-label={`Planned activities for ${entry.session}`}
    tabindex="-1"
    onclick={(event) => event.stopPropagation()}
  >
    <header>
      <div>
        <h2>{entry.session || "Unnamed session"}</h2>
        <p>{entry.day} / {summary.targetMinutes}m / {(entry.activities || []).length} activities</p>
      </div>
      <button type="button" class="icon-button" onclick={onClose} aria-label="Close planned activities" title="Close">
        <X size={16} />
      </button>
    </header>

    <div class="activity-list">
      {#each entry.activities || [] as activity, index (activity.id)}
        <article class="planned-activity" oncontextmenu={(event) => openContextMenu(event, activity.id)}>
          <div class="row-top">
            {#if editingActivityId === activity.id}
              <input
                class="desc-input quiet-edit-input"
                value={activity.description}
                oninput={(event) => onUpdateActivity(activity.id, { description: event.currentTarget.value.replace(/[\r\n]/g, " ") })}
                onblur={() => editingActivityId = null}
                onkeydown={(event) => {
                  if (event.key === "Enter") editingActivityId = null;
                  if (event.key === "Escape") editingActivityId = null;
                }}
                placeholder="Planned activity"
                use:focus
              />
            {:else}
              <button type="button" class="desc-text" onclick={() => editingActivityId = activity.id}>
                {activity.description || "Planned activity"}
              </button>
            {/if}
            <div class="activity-actions">
              <button type="button" class="row-btn" disabled={index === 0} onclick={() => onMoveActivity(activity.id, "up")} aria-label="Move planned activity up" title="Move up">
                <ChevronUp size={13} />
              </button>
              <button type="button" class="row-btn" disabled={index === entry.activities.length - 1} onclick={() => onMoveActivity(activity.id, "down")} aria-label="Move planned activity down" title="Move down">
                <ChevronDown size={13} />
              </button>
              <button type="button" class="row-btn del" onclick={() => onDeleteActivity(activity.id)} aria-label="Delete planned activity" title="Delete">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <div class="row-bottom">
            <TimeInput minutes={activity.minutes} onChange={(minutes) => onUpdateActivity(activity.id, { minutes })} variant="badge" />
            <SubjectInput subjects={activity.subjects} onChange={(subjects) => onUpdateActivity(activity.id, { subjects })} variant="badge" />
          </div>
        </article>
      {/each}

      {#if !entry.activities?.length}
        <p class="empty">No planned activities yet.</p>
      {/if}
    </div>

    <footer>
      <button type="button" class="add-btn" onclick={onAddActivity}>
        <Plus size={14} /> Add activity
      </button>
    </footer>
  </div>
</div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={contextMenuItems}
    ariaLabel="Planned activity actions"
    preserveFocus={Boolean(contextMenu.editable)}
  />
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 24px;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.42);
    box-sizing: border-box;
  }

  .plan-modal {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    flex: 0 0 auto;
    width: min(680px, 100%);
    margin: auto 0;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    overflow: visible;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--surface-2);
  }

  h2 {
    margin: 0;
    color: var(--text-color);
    font-size: var(--text-lg);
  }

  p {
    margin: 4px 0 0;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .icon-button,
  .row-btn {
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .icon-button:hover {
    background: var(--surface-hover);
    color: var(--text-color);
  }

  .row-btn:hover:not(:disabled) {
    background: transparent;
    color: var(--text-color);
  }

  .row-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .row-btn.del:hover {
    color: #ff5555;
    background: transparent;
  }

  .activity-list {
    overflow: visible;
    min-height: 0;
  }

  .planned-activity {
    display: grid;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .row-top {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .desc-text {
    flex: 1;
    min-width: 0;
    min-height: 24px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-color);
    font-size: var(--text-sm);
    text-align: left;
    cursor: pointer;
  }

  .desc-text:hover {
    color: var(--accent);
  }

  .desc-input {
    flex: 1;
    min-width: 0;
    min-height: 28px;
    padding: 4px 8px;
    color: var(--text-color);
    font-size: var(--text-sm);
  }

  .activity-actions {
    display: inline-flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .row-bottom {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .empty {
    padding: 22px 16px;
    color: var(--text-muted);
  }

  footer {
    padding: 10px 16px;
    border-top: 1px solid var(--border-subtle);
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    border: 0;
    background: transparent;
    color: var(--accent);
    cursor: pointer;
  }

  .add-btn:hover {
    color: var(--text-color);
  }
</style>
