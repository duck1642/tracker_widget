<script>
  // @ts-nocheck
  import { ChevronDown, ChevronUp, Plus, Trash2, X } from "@lucide/svelte";
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
  let summary = $derived(planSummary(entry));

  function focus(node) {
    node.focus();
  }
</script>

<svelte:window onkeydown={(event) => { if (event.key === "Escape") onClose(); }} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-backdrop" role="presentation" onclick={onClose}>
  <div
    class="plan-modal"
    role="dialog"
    aria-modal="true"
    aria-label={`Planned activities for ${entry.session}`}
    tabindex="-1"
    onclick={(event) => event.stopPropagation()}
  >
    <header>
      <div>
        <h2>{entry.session || "Unnamed session"}</h2>
        <p>{entry.day} · {summary.targetMinutes}m · {(entry.activities || []).length} activities</p>
      </div>
      <button type="button" class="icon-button" onclick={onClose} aria-label="Close planned activities" title="Close">
        <X size={16} />
      </button>
    </header>

    <div class="activity-list">
      {#each entry.activities || [] as activity, index (activity.id)}
        <article class="planned-activity">
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

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.42);
  }

  .plan-modal {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    width: min(680px, 100%);
    max-height: min(720px, calc(100vh - 48px));
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
  }

  .icon-button:hover,
  .row-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text-color);
  }

  .row-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .row-btn.del:hover {
    color: #ff8888;
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
