<script>
  // @ts-nocheck
  let {
    day,
    count = 0,
    collapsed = false,
    collapseDisabled = false,
    onToggle
  } = $props();
</script>

<header class="day-header" class:collapsed>
  <button
    type="button"
    onclick={() => onToggle?.(day)}
    aria-expanded={!collapsed}
    aria-label={`${collapsed ? "Expand" : "Collapse"} ${day}`}
    disabled={collapseDisabled}
  >
    <span class="day-name">{day}</span><span>{count}</span>
  </button>
</header>

<style>
  .day-header {
    min-height: 38px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-2);
  }

  .day-header.collapsed { border-bottom: 0; }

  button {
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

  button:focus-visible { outline: 1px solid var(--accent); outline-offset: -2px; }
  button:disabled { cursor: default; }

  .day-name {
    margin: 0;
    color: var(--accent);
    font-size: var(--text-sm);
    font-weight: 750;
  }

  span {
    color: var(--text-muted);
    font-size: var(--text-xs);
  }
</style>
