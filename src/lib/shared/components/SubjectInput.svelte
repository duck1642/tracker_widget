<script>
  // @ts-nocheck
  import { isValidSubject } from "$lib/shared/parsers/inlineMetadata.js";
  let { subjects = [], onChange, label = "Subjects" } = $props();
  let invalid = $state(false);

  function handleInput(event) {
    const next = event.currentTarget.value.split(",").map((item) => item.trim().normalize("NFC")).filter(Boolean);
    invalid = next.length === 0 || next.some((subject) => !isValidSubject(subject));
    if (!invalid) onChange(next);
  }
</script>

<label>
  <span>{label}</span>
  <input value={subjects.join(", ")} oninput={handleInput} aria-invalid={invalid} required placeholder="rust, programming" />
  {#if invalid}<small>Use letters, numbers, _ or -. At least one subject is required.</small>{/if}
</label>

<style>
  label { display: grid; gap: 4px; min-width: 0; }
  span { color: var(--text-muted); font-size: var(--text-xs); }
  input { width: 100%; box-sizing: border-box; }
  input[aria-invalid="true"] { border-color: var(--danger); }
  small { color: var(--danger); font-size: var(--text-xs); }
</style>
