<script>
  // @ts-nocheck
  let { minutes = 1, onChange, variant = "default" } = $props();
  let isEditing = $state(false);

  function focus(node) {
    node.focus();
  }
</script>

{#if variant === "badge"}
  <div class="time-badge-container">
    {#if isEditing}
      <input
        type="number"
        min="1"
        step="1"
        class="badge-input"
        value={minutes}
        oninput={(event) => onChange(Math.max(1, Number(event.currentTarget.value) || 1))}
        onblur={() => isEditing = false}
        onkeydown={(e) => { if (e.key === "Enter") isEditing = false; }}
        use:focus
      />
    {:else}
      <button type="button" class="time-badge" onclick={() => isEditing = true} aria-label="Edit minutes spent">
        {minutes}m
      </button>
    {/if}
  </div>
{:else}
  <label>
    <span>Minutes</span>
    <input type="number" min="1" step="1" value={minutes} oninput={(event) => onChange(Math.max(1, Number(event.currentTarget.value) || 1))} />
  </label>
{/if}

<style>
  label { display: grid; gap: 4px; width: 86px; }
  span { color: var(--text-muted); font-size: var(--text-xs); }
  input { width: 100%; box-sizing: border-box; }

  /* Badge styling */
  .time-badge {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid #3d3d3d;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
    cursor: pointer;
  }
  .time-badge:hover {
    border-color: #555;
    color: var(--text-color);
  }
  .badge-input {
    background: transparent;
    color: var(--text-color);
    border: 1px solid #3d3d3d;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
    width: 60px;
    box-sizing: border-box;
    outline: none;
  }
  .badge-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-soft);
  }
</style>
