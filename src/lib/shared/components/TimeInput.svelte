<script>
  // @ts-nocheck
  let { minutes = 0, onChange, variant = "default" } = $props();
  let isEditing = $state(false);
  let localValue = $state(0);

  // Sync prop changes back to localValue when not editing
  $effect(() => {
    if (!isEditing) {
      localValue = minutes;
    }
  });

  function handleCommit() {
    const valStr = String(localValue).trim();
    const next = valStr === "" ? minutes : Math.max(0, Number(valStr) || 0);
    onChange(next);
    isEditing = false;
  }

  function focus(node) {
    node.focus();
  }
</script>

{#if variant === "badge"}
  <div class="time-badge-container">
    {#if isEditing}
      <input
        type="number"
        min="0"
        class="badge-input"
        bind:value={localValue}
        onblur={handleCommit}
        onkeydown={(e) => { if (e.key === "Enter") handleCommit(); }}
        use:focus
      />
    {:else}
      <button type="button" class="time-badge" onclick={() => { localValue = minutes; isEditing = true; }} aria-label="Edit minutes spent">
        {minutes}m
      </button>
    {/if}
  </div>
{:else}
  <label>
    <span>Minutes</span>
    <input
      type="number"
      min="0"
      value={minutes}
      onchange={(event) => {
        const valStr = event.currentTarget.value.trim();
        const next = valStr === "" ? minutes : Math.max(0, Number(valStr) || 0);
        onChange(next);
      }}
    />
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
    padding: 0 8px;
    height: 26px;
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
  .time-badge:hover {
    border-color: #555;
    color: var(--text-color);
  }
  .badge-input::-webkit-outer-spin-button,
  .badge-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .badge-input {
    -moz-appearance: textfield;
    appearance: textfield;
    background: transparent;
    color: var(--text-color);
    border: 1px solid #3d3d3d;
    border-radius: 4px;
    padding: 0 8px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    width: 60px;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
  }
  .badge-input:hover {
    border-color: #555;
  }
  .badge-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-soft);
  }
</style>
