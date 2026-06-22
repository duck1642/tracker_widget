<script>
  // @ts-nocheck
  import { Trash2 } from "@lucide/svelte";
  import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
  let { objective, onUpdate, onDelete } = $props();

  let isEditingDesc = $state(false);
  let showStatusDropdown = $state(false);
  /** @type {HTMLDivElement | undefined} */
  let dropdownEl = $state();

  function toggleOrigin() {
    onUpdate({ origin: objective.origin === "planned" ? "unplanned" : "planned" });
  }

  function handleOutsideClick(event) {
    if (showStatusDropdown && dropdownEl && !dropdownEl.contains(event.target)) {
      showStatusDropdown = false;
    }
  }

  $effect(() => {
    if (showStatusDropdown) {
      document.addEventListener("pointerdown", handleOutsideClick);
    } else {
      document.removeEventListener("pointerdown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
    };
  });

  function focus(node) {
    node.focus();
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
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
    
    <div class="status-dropdown-container" bind:this={dropdownEl}>
      <button
        type="button"
        aria-label="Status"
        class={`status-badge ${objective.status}`}
        onclick={() => showStatusDropdown = !showStatusDropdown}
      >
        {capitalize(objective.status)}
      </button>

      {#if showStatusDropdown}
        <div class="dropdown-menu" role="menu">
          {#each ["open", "done", "partial", "cancelled"] as opt}
            <button
              type="button"
              class={`menu-item ${opt} ${objective.status === opt ? "active" : ""}`}
              onclick={() => {
                onUpdate({ status: opt });
                showStatusDropdown = false;
              }}
              role="menuitem"
              aria-label={capitalize(opt)}
            >
              {capitalize(opt)}
            </button>
          {/each}
        </div>
      {/if}
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
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    box-sizing: border-box;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .origin-badge:hover {
    border-color: #555;
    color: var(--text-color);
  }

  /* Status select styling */
  .status-dropdown-container {
    position: relative;
    display: inline-flex;
  }
  .status-badge {
    background: transparent;
    border-radius: 4px;
    padding: 0 8px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    outline: none;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  /* Color themes for status */
  .status-badge.open {
    border: 1px solid #444444;
    color: var(--text-muted);
  }
  .status-badge.open:hover {
    border-color: #666;
    color: var(--text-color);
  }
  .status-badge.done {
    border: 1px solid #3a532d;
    color: #b8df9e;
  }
  .status-badge.done:hover {
    border-color: #5c8547;
    color: #c8f0ae;
  }
  .status-badge.partial {
    border: 1px solid #5a4b22;
    color: #e4c070;
  }
  .status-badge.partial:hover {
    border-color: #8f7636;
    color: #f0d48f;
  }
  .status-badge.cancelled {
    border: 1px solid #632d2d;
    color: #ff8888;
  }
  .status-badge.cancelled:hover {
    border-color: #9c4747;
    color: #ffa3a3;
  }

  /* Dropdown Menu styling */
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    width: 100px;
    padding: 4px;
    border: 1px solid #333333;
    border-radius: 6px;
    background: #181818;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    box-sizing: border-box;
  }
  .menu-item {
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
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

  /* Dropdown Menu item colors & hovers */
  .menu-item.open {
    color: var(--text-muted);
  }
  .menu-item.open:hover, .menu-item.open.active {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-color);
  }
  .menu-item.done {
    color: #b8df9e;
  }
  .menu-item.done:hover, .menu-item.done.active {
    background: rgba(184, 223, 158, 0.1);
    color: #c8f0ae;
  }
  .menu-item.partial {
    color: #e4c070;
  }
  .menu-item.partial:hover, .menu-item.partial.active {
    background: rgba(228, 192, 112, 0.1);
    color: #f0d48f;
  }
  .menu-item.cancelled {
    color: #ff8888;
  }
  .menu-item.cancelled:hover, .menu-item.cancelled.active {
    background: rgba(255, 136, 136, 0.1);
    color: #ffa3a3;
  }
</style>

