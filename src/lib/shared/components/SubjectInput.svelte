<script>
  // @ts-nocheck
  import { isValidSubject } from "$lib/shared/parsers/inlineMetadata.js";
  let { subjects = [], onChange, label = "Subjects", variant = "default" } = $props();
  let invalid = $state(false);
  let isEditing = $state(false);
  let currentText = $state("");

  function handleInput(event) {
    currentText = event.currentTarget.value;
    const next = currentText.split(",").map((item) => item.trim().normalize("NFC")).filter(Boolean);
    invalid = next.length === 0 || next.some((subject) => !isValidSubject(subject));
    if (!invalid) onChange(next);
  }

  function focus(node) {
    node.focus();
  }
</script>

{#if variant === "badge"}
  <div class="subject-badges-container">
    {#if isEditing}
      <div class="badge-input-container">
        <span class="badge-input-sizer">{currentText || "rust, programming"}</span>
        <input
          class="badge-input"
          value={currentText}
          oninput={handleInput}
          onblur={() => isEditing = false}
          onkeydown={(e) => { if (e.key === "Enter") isEditing = false; }}
          aria-invalid={invalid}
          placeholder="rust, programming"
          use:focus
        />
      </div>
    {:else}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
      <div class="subject-badges" onclick={() => { currentText = subjects.join(", "); isEditing = true; }} role="button" tabindex="0" aria-label="Edit subjects">
        {#each subjects as subject}
          <div class="subject-badge">{subject}</div>
        {/each}
        {#if subjects.length === 0}
          <div class="subject-badge placeholder">Add subject...</div>
        {/if}
      </div>
    {/if}
    {#if invalid}<small class="badge-error">Invalid format</small>{/if}
  </div>
{:else}
  <label>
    <span>{label}</span>
    <input value={subjects.join(", ")} oninput={handleInput} aria-invalid={invalid} required placeholder="rust, programming" />
    {#if invalid}<small>Use letters, numbers, _ or -. At least one subject is required.</small>{/if}
  </label>
{/if}

<style>
  label { display: grid; gap: 4px; min-width: 0; }
  span { color: var(--text-muted); font-size: var(--text-xs); }
  input { width: 100%; box-sizing: border-box; }
  input[aria-invalid="true"] { border-color: var(--danger); }
  small { color: var(--danger); font-size: var(--text-xs); }

  /* Badge styling */
  .subject-badges-container { display: inline-flex; flex-direction: column; gap: 2px; }
  .subject-badges {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    align-items: center;
    outline: none;
  }
  .subject-badge {
    background: #121212;
    color: #b3b3b3;
    border: 1px solid #2d2d2d;
    border-radius: 4px;
    padding: 0 8px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }
  .subject-badges:hover .subject-badge {
    border-color: #555;
    color: var(--text-color);
  }
  .subject-badge.placeholder {
    color: var(--text-muted);
    border-style: dashed;
    background: transparent;
  }
  .badge-input-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    height: 26px;
    min-width: 60px;
    max-width: 280px;
    box-sizing: border-box;
    overflow: hidden;
  }
  .badge-input-sizer {
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    padding: 0 8px;
    border: 1px solid transparent;
    white-space: pre;
    visibility: hidden;
    pointer-events: none;
    user-select: none;
  }
  .badge-input {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: #121212;
    color: #b3b3b3;
    border: 1px solid #2d2d2d;
    border-radius: 4px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    box-sizing: border-box;
    outline: none;
    transition: all 0.15s ease;
  }
  .badge-input:hover {
    border-color: #555;
  }
  .badge-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-soft);
  }
  .badge-error {
    color: var(--danger);
    font-size: 9px;
    margin-top: 1px;
  }
</style>
