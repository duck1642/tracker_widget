<script>
  let { value = "", onChange, label = "Notes" } = $props();
</script>

<section class="notes-editor">
  <label for="notes-area">{label}</label>
  <textarea id="notes-area" value={value} oninput={(event) => onChange(event.currentTarget.value)} onkeydown={(event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      target.value = `${target.value.slice(0, start)}  ${target.value.slice(target.selectionEnd)}`;
      target.selectionStart = target.selectionEnd = start + 2;
      onChange(target.value);
    }
  }} spellcheck="true"></textarea>
</section>

<style>
  .notes-editor { display: grid; gap: 8px; }
  label { color: var(--text-muted); font-size: var(--text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  textarea { min-height: 150px; resize: vertical; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-dark); color: var(--text-color); padding: 12px; font: 12px/1.6 var(--font-mono); }
</style>
