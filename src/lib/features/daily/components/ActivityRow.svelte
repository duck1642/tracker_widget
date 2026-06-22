<script>
  // @ts-nocheck
  import { Trash2 } from "@lucide/svelte";
  import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
  import TimeInput from "$lib/shared/components/TimeInput.svelte";
  let { activity, onUpdate, onDelete } = $props();

  let isEditingDesc = $state(false);

  function focus(node) {
    node.focus();
  }
</script>

<article class="activity-card">
  <div class="row-top">
    {#if isEditingDesc}
      <input
        class="desc-input"
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
    <button class="row-btn del" onclick={onDelete} aria-label="Delete activity" title="Delete">
      <Trash2 size={13} />
    </button>
  </div>
  <div class="row-bottom">
    <SubjectInput subjects={activity.subjects} onChange={(subjects) => onUpdate({ subjects })} variant="badge" />
    <TimeInput minutes={activity.minutes} onChange={(minutes) => onUpdate({ minutes })} variant="badge" />
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
    background: transparent;
    border: none;
    border-bottom: 1px dashed var(--border-strong);
    color: var(--text-color);
    font-size: var(--text-sm);
    outline: none;
    padding: 2px 0;
  }
  .row-bottom {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
