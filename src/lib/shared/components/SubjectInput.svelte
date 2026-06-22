<script>
  // @ts-nocheck
  import { isValidSubject } from "$lib/shared/parsers/inlineMetadata.js";
  let { subjects = [], onChange, label = "Subjects", variant = "default" } = $props();
  let invalid = $state(false);
  let isEditing = $state(false);

  function handleInput(event) {
    const next = event.currentTarget.value.split(",").map((item) => item.trim().normalize("NFC")).filter(Boolean);
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
      <input
        class="badge-input"
        value={subjects.join(", ")}
        oninput={handleInput}
        onblur={() => isEditing = false}
        onkeydown={(e) => { if (e.key === "Enter") isEditing = false; }}
        aria-invalid={invalid}
        placeholder="rust, programming"
        use:focus
      />
    {:else}
      <button type="button" class="subject-badges" onclick={() => isEditing = true} aria-label="Edit subjects">
        {#each subjects as subject}
          <span class="subject-badge">{subject}</span>
        {/each}
        {#if subjects.length === 0}
          <span class="subject-badge placeholder">Add subject...</span>
        {/if}
      </button>
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
  }
  .subject-badge {
    background: #121212;
    color: #b3b3b3;
    border: 1px solid #2d2d2d;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
  }
  .subject-badge.placeholder {
    color: var(--text-muted);
    border-style: dashed;
    background: transparent;
  }
  .badge-input {
    background: #121212;
    color: #b3b3b3;
    border: 1px solid #2d2d2d;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
    width: 140px;
    box-sizing: border-box;
    outline: none;
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
