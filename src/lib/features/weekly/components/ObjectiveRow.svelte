<script>
  // @ts-nocheck
  import { Trash2 } from "@lucide/svelte";
  import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
  let { objective, onUpdate, onDelete } = $props();

  let isEditingDesc = $state(false);

  function toggleOrigin() {
    onUpdate({ origin: objective.origin === "planned" ? "unplanned" : "planned" });
  }

  function focus(node) {
    node.focus();
  }
</script>

<article class="objective-card">
  <div class="row-top">
    {#if isEditingDesc}
      <input
        class="desc-input"
        value={objective.description}
        oninput={(event) => onUpdate({ description: event.currentTarget.value.replace(/[\r\n]/g, " ") })}
        onblur={() => isEditingDesc = false}
        onkeydown={(e) => { if (e.key === "Enter") isEditingDesc = false; }}
        placeholder="Objective description"
        use:focus
      />
    {:else}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span class="desc-text" onclick={() => isEditingDesc = true}>
        {objective.description || "Add objective description..."}
      </span>
    {/if}
    <button class="row-btn del" onclick={onDelete} aria-label="Delete objective" title="Delete">
      <Trash2 size={13} />
    </button>
  </div>
  <div class="row-bottom">
    <SubjectInput subjects={objective.subjects} onChange={(subjects) => onUpdate({ subjects })} variant="badge" />
    
    <button type="button" class="origin-badge" onclick={toggleOrigin}>
      {objective.origin === "planned" ? "Planned" : "Unplanned"}
    </button>
    
    <div class="status-select-container">
      <select aria-label="Status" class={`status-select ${objective.status}`} value={objective.status} onchange={(event) => onUpdate({ status: event.currentTarget.value })}>
        <option value="open">Open</option>
        <option value="done">Done</option>
        <option value="partial">Partial</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>
  </div>
</article>

<style>
  .objective-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-subtle);
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

  /* Origin badge */
  .origin-badge {
    background: transparent;
    color: #888888;
    border: 1px solid #3d3d3d;
    border-radius: 4px;
    padding: 0 8px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    font-weight: 600;
    box-sizing: border-box;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .origin-badge:hover {
    border-color: #555;
    color: var(--text-color);
  }

  /* Status select styling */
  .status-select-container {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .status-select {
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    border-radius: 4px;
    padding: 0 8px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    outline: none;
    width: auto;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  /* Color themes for status */
  .status-select.open {
    border: 1px solid #444444;
    color: var(--text-muted);
  }
  .status-select.open:hover {
    border-color: #666;
    color: var(--text-color);
  }
  .status-select.done {
    border: 1px solid #3a532d;
    color: #b8df9e;
  }
  .status-select.done:hover {
    border-color: #5c8547;
    color: #c8f0ae;
  }
  .status-select.partial {
    border: 1px solid #5a4b22;
    color: #e4c070;
  }
  .status-select.partial:hover {
    border-color: #8f7636;
    color: #f0d48f;
  }
  .status-select.cancelled {
    border: 1px solid #632d2d;
    color: #ff8888;
  }
  .status-select.cancelled:hover {
    border-color: #9c4747;
    color: #ffa3a3;
  }
  
  option {
    background: var(--bg-panel);
    color: var(--text-color);
  }
</style>

