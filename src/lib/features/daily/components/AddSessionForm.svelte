<script>
  import { Plus } from "@lucide/svelte";

  let { suggestions = [], existingSessions = [], onAdd } = $props();
  let name = $state("");
  let editing = $state(false);
  let showDropdown = $state(false);
  let highlightedIndex = $state(-1);

  /** @type {HTMLInputElement | null} */
  let inputEl = $state(null);

  /** @param {string} value */
  const normalize = (value) => value.trim().toLowerCase();

  let filteredSuggestions = $derived(
    suggestions.filter(s => {
      const match = s.toLowerCase().includes(name.trim().toLowerCase());
      const alreadyExists = existingSessions.some(session => normalize(session) === normalize(s));
      return match && !alreadyExists;
    })
  );

  $effect(() => {
    if (editing && inputEl) {
      inputEl.focus();
    }
  });

  $effect(() => {
    // Keep highlighted index in bounds when suggestions change
    if (highlightedIndex >= filteredSuggestions.length) {
      highlightedIndex = filteredSuggestions.length - 1;
    }
  });

  function openEditor() {
    editing = true;
    showDropdown = suggestions.length > 0;
    highlightedIndex = -1;
  }

  /** @param {string} value */
  function submitName(value) {
    if (onAdd(value)) {
      name = "";
      editing = false;
      showDropdown = false;
      highlightedIndex = -1;
    }
  }

  function resolveSubmittedName() {
    const trimmed = name.trim();
    return filteredSuggestions.find((suggestion) => normalize(suggestion) === normalize(trimmed)) || trimmed;
  }

  /** @param {SubmitEvent} event */
  function handleSubmit(event) {
    event.preventDefault();
    if (name.trim()) {
      submitName(resolveSubmittedName());
    }
  }

  /** @param {KeyboardEvent} event */
  function handleKeyDown(event) {
    if (event.key === "Escape") {
      cancelEditing();
    } else if (event.key === "ArrowDown") {
      if (showDropdown && filteredSuggestions.length > 0) {
        event.preventDefault();
        highlightedIndex = (highlightedIndex + 1) % filteredSuggestions.length;
      } else {
        showDropdown = true;
      }
    } else if (event.key === "ArrowUp") {
      if (showDropdown && filteredSuggestions.length > 0) {
        event.preventDefault();
        highlightedIndex = (highlightedIndex - 1 + filteredSuggestions.length) % filteredSuggestions.length;
      }
    } else if (event.key === "Enter") {
      if (showDropdown && highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        event.preventDefault();
        selectSuggestion(filteredSuggestions[highlightedIndex]);
      }
    }
  }

  function handleBlur() {
    setTimeout(() => {
      showDropdown = false;
    }, 150);
  }

  /** @param {string} suggestion */
  function selectSuggestion(suggestion) {
    name = suggestion;
    showDropdown = false;
    highlightedIndex = -1;
    submitName(name);
  }

  function cancelEditing() {
    name = "";
    editing = false;
    showDropdown = false;
    highlightedIndex = -1;
  }
</script>

<div class="add-session-container">
  {#if !editing}
    <button class="add-session-trigger" onclick={openEditor} type="button">
      <Plus size={14} /> Add session
    </button>
  {:else}
    <form onsubmit={handleSubmit} class="add-session-form">
      <div class="input-container">
        <div class="input-wrapper">
          <input
            bind:this={inputEl}
            bind:value={name}
            placeholder="Session name..."
            onkeydown={handleKeyDown}
            onfocus={() => showDropdown = true}
            onblur={handleBlur}
            autocomplete="off"
            spellcheck="false"
          />
          {#if showDropdown && filteredSuggestions.length > 0}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <ul class="suggestions-dropdown" onmousedown={(e) => e.preventDefault()}>
              {#each filteredSuggestions as suggestion, index}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
                <li
                  class="suggestion-item"
                  class:highlighted={index === highlightedIndex}
                  onmouseenter={() => highlightedIndex = index}
                  onclick={() => selectSuggestion(suggestion)}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  title={suggestion}
                >
                  {suggestion}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
        <button class="submit-btn" type="submit">Add</button>
        <button class="cancel-btn" type="button" onclick={cancelEditing}>Cancel</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-session-container {
    display: flex;
    width: 100%;
    box-sizing: border-box;
  }
  .add-session-form {
    position: relative;
    display: block;
    width: 100%;
  }
  .input-container {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    box-sizing: border-box;
  }
  .input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    min-width: 180px;
  }
  input {
    width: 100%;
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid var(--border-color);
    border-radius: 5px;
    background: var(--surface-2);
    color: var(--text-color);
    font-size: var(--text-sm);
    outline: none;
    box-sizing: border-box;
  }
  input:focus {
    outline: none;
    border-color: var(--border-strong);
    box-shadow: none;
  }
  .submit-btn {
    min-height: 34px;
    padding: 0 14px;
    background: var(--accent);
    color: var(--accent-ink);
    border: none;
    border-radius: 5px;
    font-weight: 600;
    font-size: var(--text-sm);
    cursor: pointer;
    box-sizing: border-box;
  }
  .submit-btn:hover {
    filter: brightness(1.1);
  }
  .cancel-btn {
    min-height: 34px;
    padding: 0 12px;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border-color);
    border-radius: 5px;
    font-size: var(--text-sm);
    cursor: pointer;
    box-sizing: border-box;
  }
  .cancel-btn:hover {
    background: var(--surface-hover);
    color: var(--text-color);
  }
  .add-session-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    margin-left: -8px;
    padding: 0 8px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--accent);
    cursor: pointer;
  }
  .suggestions-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 50;
    width: 100%;
    max-height: 156px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
    margin: 4px 0 0 0;
    padding: 4px 0;
    list-style: none;
    background: #181818;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    box-sizing: border-box;
  }
  .suggestions-dropdown::-webkit-scrollbar {
    width: 6px;
  }
  .suggestions-dropdown::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: var(--border-strong);
  }
  .suggestions-dropdown::-webkit-scrollbar-track {
    background: transparent;
  }
  .suggestion-item {
    padding: 8px 12px;
    font-size: var(--text-sm);
    color: var(--text-muted);
    cursor: pointer;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: background 0.1s ease, color 0.1s ease;
  }
  .suggestion-item:hover, .suggestion-item.highlighted {
    background: var(--surface-hover);
    color: var(--text-color);
  }
</style>
