<script>
  // @ts-nocheck
  import { X } from "@lucide/svelte";
  import { subjectHistoryStore } from "$lib/app/subjectHistoryStore.svelte.js";
  import { isValidSubject } from "$lib/shared/parsers/inlineMetadata.js";

  let { subjects = [], onChange, label = "Subjects", variant = "default" } = $props();
  let invalid = $state(false);
  let addText = $state("");
  let editingIndex = $state(null);
  let editText = $state("");
  let showSuggestions = $state(false);
  let highlightedSuggestion = $state(0);

  /** @type {HTMLInputElement | null} */
  let addInput = $state(null);

  const normalize = (value) => value.trim().normalize("NFC");
  const keyFor = (value) => normalize(value).toLowerCase();
  const canRemove = $derived(subjects.length > 1);
  const activeText = $derived(editingIndex === null ? addText : editText);
  const activeAllowedIndex = $derived(editingIndex === null ? null : editingIndex);
  const filteredSuggestions = $derived(
    subjectHistoryStore.suggestions.filter((suggestion) => {
      const query = activeText.trim().toLowerCase();
      return (!query || suggestion.toLowerCase().includes(query))
        && !isDuplicate(suggestion, activeAllowedIndex);
    })
  );

  $effect(() => {
    if (highlightedSuggestion >= filteredSuggestions.length) {
      highlightedSuggestion = Math.max(0, filteredSuggestions.length - 1);
    }
  });

  function focus(node) {
    node.focus();
  }

  function focusAddInput() {
    addInput?.focus();
  }

  function isDuplicate(value, allowedIndex = null) {
    const key = keyFor(value);
    return subjects.some((subject, index) => index !== allowedIndex && keyFor(subject) === key);
  }

  function validSubject(value, allowedIndex = null) {
    const next = normalize(value);
    return Boolean(next) && isValidSubject(next) && !isDuplicate(next, allowedIndex);
  }

  function commitAdd() {
    const next = normalize(addText);
    if (!validSubject(next)) {
      invalid = Boolean(next);
      return false;
    }
    onChange([...subjects, next]);
    void subjectHistoryStore.record([next]);
    addText = "";
    invalid = false;
    showSuggestions = false;
    return true;
  }

  function startEdit(index) {
    editingIndex = index;
    editText = subjects[index] || "";
    invalid = false;
    showSuggestions = true;
    highlightedSuggestion = 0;
  }

  function cancelEdit() {
    editingIndex = null;
    editText = "";
    invalid = false;
    showSuggestions = false;
  }

  function commitEdit() {
    if (editingIndex === null) return false;
    const next = normalize(editText);
    if (!validSubject(next, editingIndex)) {
      invalid = Boolean(next);
      return false;
    }
    const updated = subjects.map((subject, index) => index === editingIndex ? next : subject);
    onChange(updated);
    void subjectHistoryStore.record([next]);
    cancelEdit();
    return true;
  }

  function removeSubject(index) {
    if (!canRemove) return;
    onChange(subjects.filter((_, subjectIndex) => subjectIndex !== index));
    if (editingIndex === index) cancelEdit();
  }

  function handleAddKeydown(event) {
    if (event.key === "Enter" || event.key === "Tab" || event.key === ",") {
      if ((event.key === "Enter" || event.key === "Tab") && showSuggestions && filteredSuggestions.length > 0) {
        event.preventDefault();
        selectSuggestion(filteredSuggestions[highlightedSuggestion] || filteredSuggestions[0]);
        return;
      }
      if (addText.trim()) {
        event.preventDefault();
        commitAdd();
      }
    } else if (event.key === "Escape") {
      addText = "";
      invalid = false;
      showSuggestions = false;
    } else if (event.key === "Backspace" && !addText && canRemove) {
      event.preventDefault();
      removeSubject(subjects.length - 1);
    } else if (event.key === "ArrowDown" && filteredSuggestions.length > 0) {
      event.preventDefault();
      showSuggestions = true;
      highlightedSuggestion = (highlightedSuggestion + 1) % filteredSuggestions.length;
    } else if (event.key === "ArrowUp" && filteredSuggestions.length > 0) {
      event.preventDefault();
      showSuggestions = true;
      highlightedSuggestion = (highlightedSuggestion - 1 + filteredSuggestions.length) % filteredSuggestions.length;
    }
  }

  function handleEditKeydown(event) {
    if (event.key === "Enter" || event.key === "Tab" || event.key === ",") {
      event.preventDefault();
      if ((event.key === "Enter" || event.key === "Tab") && showSuggestions && filteredSuggestions.length > 0) {
        selectSuggestion(filteredSuggestions[highlightedSuggestion] || filteredSuggestions[0]);
        return;
      }
      commitEdit();
    } else if (event.key === "Escape") {
      cancelEdit();
    } else if (event.key === "ArrowDown" && filteredSuggestions.length > 0) {
      event.preventDefault();
      showSuggestions = true;
      highlightedSuggestion = (highlightedSuggestion + 1) % filteredSuggestions.length;
    } else if (event.key === "ArrowUp" && filteredSuggestions.length > 0) {
      event.preventDefault();
      showSuggestions = true;
      highlightedSuggestion = (highlightedSuggestion - 1 + filteredSuggestions.length) % filteredSuggestions.length;
    }
  }

  function handleContainerKeydown(event) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      focusAddInput();
    }
  }

  function handleLegacyInput(event) {
    const next = event.currentTarget.value.split(",").map(normalize).filter(Boolean);
    invalid = next.length === 0 || next.some((subject, index) => !isValidSubject(subject) || next.findIndex((item) => keyFor(item) === keyFor(subject)) !== index);
    if (!invalid) onChange(next);
  }

  function selectSuggestion(suggestion) {
    if (editingIndex === null) {
      addText = suggestion;
      commitAdd();
    } else {
      editText = suggestion;
      commitEdit();
    }
  }
</script>

{#if variant === "badge"}
  <div class="subject-badges-container">
    <div class="subject-badges" onclick={focusAddInput} onkeydown={handleContainerKeydown} role="button" tabindex="0" aria-label="Subject editor">
      {#each subjects as subject, index}
        {#if editingIndex === index}
          <span class="badge-input-container">
            <span class="badge-input-sizer">{editText || subject}</span>
            <input
              class="badge-input"
              value={editText}
              oninput={(event) => { editText = event.currentTarget.value; invalid = false; showSuggestions = true; highlightedSuggestion = 0; }}
              onfocus={() => { showSuggestions = true; highlightedSuggestion = 0; }}
              onblur={() => setTimeout(commitEdit, 120)}
              onkeydown={handleEditKeydown}
              aria-label={`Edit subject ${subject}`}
              aria-invalid={invalid}
              use:focus
            />
            {#if showSuggestions && editingIndex === index && filteredSuggestions.length > 0}
              <div class="subject-suggestions" role="listbox" aria-label="Subject suggestions">
                {#each filteredSuggestions as suggestion, suggestionIndex}
                  <button
                    type="button"
                    class:highlighted={suggestionIndex === highlightedSuggestion}
                    role="option"
                    aria-selected={suggestionIndex === highlightedSuggestion}
                    title={suggestion}
                    onpointerdown={(event) => event.preventDefault()}
                    onclick={(event) => { event.stopPropagation(); selectSuggestion(suggestion); }}
                  >
                    {suggestion}
                  </button>
                {/each}
              </div>
            {/if}
          </span>
        {:else}
          <span class="subject-badge" title={subject}>
            <button type="button" class="subject-label" onclick={(event) => { event.stopPropagation(); startEdit(index); }} title={`Edit ${subject}`}>
              {subject}
            </button>
            {#if canRemove}
              <button type="button" class="subject-remove" onclick={(event) => { event.stopPropagation(); removeSubject(index); }} aria-label={`Remove ${subject}`} title={`Remove ${subject}`}>
                <X size={11} />
              </button>
            {/if}
          </span>
        {/if}
      {/each}

      <span class="badge-input-container add-subject">
        <span class="badge-input-sizer">{addText || "subject"}</span>
        <input
          bind:this={addInput}
          class="badge-input add-input"
          class:empty-add={!addText}
          value={addText}
          oninput={(event) => { addText = event.currentTarget.value; invalid = false; showSuggestions = true; highlightedSuggestion = 0; }}
          onfocus={() => { showSuggestions = true; highlightedSuggestion = 0; }}
          onkeydown={handleAddKeydown}
          onblur={() => setTimeout(() => { if (addText.trim()) commitAdd(); else showSuggestions = false; }, 120)}
          aria-label="Add subject"
          aria-invalid={invalid}
          placeholder="+"
        />
        {#if showSuggestions && editingIndex === null && filteredSuggestions.length > 0}
          <div class="subject-suggestions" role="listbox" aria-label="Subject suggestions">
            {#each filteredSuggestions as suggestion, index}
              <button
                type="button"
                class:highlighted={index === highlightedSuggestion}
                role="option"
                aria-selected={index === highlightedSuggestion}
                title={suggestion}
                onpointerdown={(event) => event.preventDefault()}
                onclick={(event) => { event.stopPropagation(); selectSuggestion(suggestion); }}
              >
                {suggestion}
              </button>
            {/each}
          </div>
        {/if}
      </span>
    </div>
    {#if invalid}<small class="badge-error">Invalid or duplicate subject</small>{/if}
  </div>
{:else}
  <label>
    <span>{label}</span>
    <input value={subjects.join(", ")} oninput={handleLegacyInput} aria-invalid={invalid} placeholder="rust, programming" />
    {#if invalid}<small>Use letters, numbers, _ or -. At least one unique subject is required.</small>{/if}
  </label>
{/if}

<style>
  label { display: grid; gap: 4px; min-width: 0; }
  span { color: var(--text-muted); font-size: var(--text-xs); }
  input { width: 100%; box-sizing: border-box; }
  input[aria-invalid="true"] { border-color: var(--danger); }
  small { color: var(--danger); font-size: var(--text-xs); }

  .subject-badges-container { display: inline-flex; flex-direction: column; gap: 2px; min-width: 0; max-width: 100%; }
  .subject-badges {
    position: relative;
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    background: transparent;
    border: none;
    padding: 0;
    cursor: text;
    text-align: left;
    align-items: center;
    outline: none;
    min-width: 0;
    max-width: 100%;
  }
  .subject-badge {
    display: inline-flex;
    align-items: center;
    max-width: 180px;
    height: 26px;
    border: 1px solid #2d2d2d;
    border-radius: 4px;
    background: #121212;
    color: #b3b3b3;
    box-sizing: border-box;
    overflow: hidden;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .subject-badge:hover {
    border-color: #555;
    color: var(--text-color);
  }
  .subject-label {
    min-width: 0;
    height: 24px;
    padding: 0 8px;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: text;
  }
  .subject-remove {
    display: inline-grid;
    place-items: center;
    flex: 0 0 18px;
    width: 18px;
    height: 24px;
    padding: 0;
    border: 0;
    border-left: 1px solid #2d2d2d;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }
  .subject-remove:hover {
    color: var(--text-color);
    background: rgba(255, 255, 255, 0.04);
  }
  .badge-input-container {
    position: relative;
    display: inline-grid;
    align-items: center;
    height: 26px;
    min-width: 5ch;
    max-width: 180px;
    box-sizing: border-box;
    overflow: visible;
  }
  .add-subject {
    width: 26px;
    min-width: 26px;
  }
  .add-subject:focus-within,
  .add-subject:has(.badge-input:not(:placeholder-shown)) {
    width: auto;
    min-width: 5ch;
  }
  .badge-input-sizer {
    grid-area: 1 / 1;
    min-width: 2ch;
    max-width: 100%;
    padding: 0 8px;
    border: 1px solid transparent;
    color: transparent;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    white-space: pre;
    visibility: hidden;
    pointer-events: none;
    user-select: none;
    box-sizing: border-box;
  }
  .badge-input-sizer::after {
    content: "";
    display: inline-block;
    width: 1.25ch;
  }
  .badge-input {
    grid-area: 1 / 1;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    color: #b3b3b3;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 0 8px;
    font-size: 11px;
    font-weight: 600;
    line-height: 24px;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
  }
  .badge-input:hover {
    border-color: #555;
    background: #121212;
  }
  .badge-input:focus {
    background: #121212;
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-soft);
    color: var(--text-color);
  }
  .badge-input[aria-invalid="true"] {
    border-color: var(--danger);
    box-shadow: 0 0 0 1px rgba(255, 136, 136, 0.18);
  }
  .add-subject .badge-input {
    background: #121212;
    border-color: #2d2d2d;
    text-align: center;
  }
  .add-subject .badge-input.empty-add {
    padding: 0;
    line-height: 24px;
  }
  .add-subject .badge-input:hover {
    border-color: #555;
    color: var(--text-color);
  }
  .add-subject .badge-input:hover::placeholder {
    color: var(--text-color);
  }
  .add-subject .badge-input:focus {
    text-align: left;
  }
  .add-subject .badge-input:focus::placeholder {
    color: transparent;
  }
  .badge-error {
    color: var(--danger);
    font-size: 9px;
    margin-top: 1px;
  }
  .subject-suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 300;
    display: grid;
    min-width: 126px;
    max-width: 170px;
    max-height: 156px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
    padding: 4px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: #181818;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    box-sizing: border-box;
  }
  .subject-suggestions::-webkit-scrollbar {
    width: 6px;
  }
  .subject-suggestions::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: var(--border-strong);
  }
  .subject-suggestions::-webkit-scrollbar-track {
    background: transparent;
  }
  .subject-suggestions button {
    min-width: 0;
    height: 26px;
    padding: 0 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  .subject-suggestions button:hover,
  .subject-suggestions button.highlighted {
    background: var(--surface-hover);
    color: var(--text-color);
  }
</style>
