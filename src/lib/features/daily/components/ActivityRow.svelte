<script>
  // @ts-nocheck
  import { ChevronDown, ChevronUp, Trash2 } from "@lucide/svelte";
  import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
  import TimeInput from "$lib/shared/components/TimeInput.svelte";
  let { activity, canMoveUp = true, canMoveDown = true, onUpdate, onDelete, onMoveUp, onMoveDown } = $props();

  let isEditingDesc = $state(false);

  function focus(node) {
    node.focus();
  }
</script>

<article class="activity-card">
  <div class="row-top">
    {#if isEditingDesc}
      <input
        class="desc-input quiet-edit-input"
        value={activity.description}
        oninput={(event) => onUpdate({ description: event.currentTarget.value.replace(/[\r\n]/g, " ") })}
        onblur={() => isEditingDesc = false}
        onkeydown={(e) => { if (e.key === "Enter") isEditingDesc = false; }}
        placeholder="What happened?"
        use:focus
      />
    {:else}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span class="desc-text" onclick={() => isEditingDesc = true}>
        {activity.description || "What happened?"}
      </span>
    {/if}
    <div class="activity-actions">
      <button type="button" class="row-btn" disabled={!canMoveUp} onclick={onMoveUp} aria-label="Move activity up" title="Move up">
        <ChevronUp size={13} />
      </button>
      <button type="button" class="row-btn" disabled={!canMoveDown} onclick={onMoveDown} aria-label="Move activity down" title="Move down">
        <ChevronDown size={13} />
      </button>
      <button type="button" class="row-btn del" onclick={onDelete} aria-label="Delete activity" title="Delete">
        <Trash2 size={13} />
      </button>
    </div>
  </div>
  <div class="row-bottom">
    <TimeInput minutes={activity.minutes} onChange={(minutes) => onUpdate({ minutes })} variant="badge" />
    <SubjectInput subjects={activity.subjects} onChange={(subjects) => onUpdate({ subjects })} variant="badge" />
  </div>
</article>

<style>
  .activity-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-top: 1px solid var(--border-subtle);
  }
  .row-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .activity-actions {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    visibility: visible;
  }
  .row-btn {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s ease;
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
  .desc-text {
    flex: 1;
    font-size: var(--text-sm);
    color: var(--text-color);
    cursor: pointer;
    min-height: 24px;
    display: flex;
    align-items: center;
  }
  .desc-input {
    flex: 1;
    color: var(--text-color);
    font-size: var(--text-sm);
    min-height: 28px;
    padding: 4px 8px;
  }
  .row-bottom {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
