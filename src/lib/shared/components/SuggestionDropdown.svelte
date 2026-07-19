<script>
  // @ts-nocheck
  let {
    suggestions = [],
    highlightedIndex = -1,
    onSelect,
    onHighlight = () => {},
    ariaLabel = "Suggestions",
    width = "anchor",
    top = "100%",
    showPlannedMarkers = false
  } = $props();

  const labelFor = (suggestion) => typeof suggestion === "string" ? suggestion : suggestion.name;
  const isPlanned = (suggestion) => typeof suggestion !== "string" && suggestion.plannedThisWeek;

  function revealHighlighted(node, highlighted) {
    if (highlighted) queueMicrotask(() => node.scrollIntoView?.({ block: "nearest" }));
    return {
      update(next) {
        if (next) queueMicrotask(() => node.scrollIntoView?.({ block: "nearest" }));
      }
    };
  }
</script>

<div class="suggestion-dropdown" class:bounded={width === "bounded"} style:top role="listbox" aria-label={ariaLabel}>
  {#each suggestions as suggestion, index}
    {@const label = labelFor(suggestion)}
    <button
      type="button"
      role="option"
      aria-selected={index === highlightedIndex}
      class:highlighted={index === highlightedIndex}
      title={label}
      use:revealHighlighted={index === highlightedIndex}
      onpointerdown={(event) => event.preventDefault()}
      onmouseenter={() => onHighlight(index)}
      onclick={() => onSelect(suggestion)}
    >
      {#if showPlannedMarkers && isPlanned(suggestion)}<span class="planned-marker" aria-hidden="true" title="Planned this week">*</span>{/if}<span class="suggestion-label">{label}</span>
    </button>
  {/each}
</div>

<style>
  .suggestion-dropdown {
    position: absolute;
    left: 0;
    z-index: var(--layer-autocomplete);
    display: grid;
    width: 100%;
    max-height: 156px;
    margin: 0;
    padding: 4px;
    overflow-y: auto;
    scrollbar-width: none;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: #181818;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    box-sizing: border-box;
  }

  .suggestion-dropdown.bounded {
    width: max(100%, 126px);
    max-width: 180px;
  }

  .suggestion-dropdown::-webkit-scrollbar {
    display: none;
  }

  button {
    display: flex;
    align-items: center;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-size: var(--text-sm);
    text-align: left;
    cursor: pointer;
  }

  button:hover,
  button.highlighted {
    background: var(--surface-hover);
    color: var(--text-color);
  }

  .planned-marker {
    flex: 0 0 12px;
    width: 12px;
    color: var(--accent);
    font-weight: 700;
  }

  .suggestion-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
