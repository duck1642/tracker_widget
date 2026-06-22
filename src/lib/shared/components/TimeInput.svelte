<script>
  let { minutes = 1, onChange } = $props();
</script>

<label>
  <span>Minutes</span>
  <input type="number" min="1" step="1" value={minutes} oninput={(event) => onChange(Math.max(1, Number(event.currentTarget.value) || 1))} />
</label>

<style>
  label { display: grid; gap: 4px; width: 86px; }
  span { color: var(--text-muted); font-size: var(--text-xs); }
  input { width: 100%; box-sizing: border-box; }
</style>
