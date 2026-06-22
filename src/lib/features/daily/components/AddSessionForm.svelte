<script>
  let { suggestions = [], onAdd } = $props();
  let name = $state("");
</script>

<form onsubmit={(event) => { event.preventDefault(); if (onAdd(name)) name = ""; }}>
  <label for="session-name">New session</label>
  <div><input id="session-name" bind:value={name} list="planned-sessions" placeholder="Session name" /><datalist id="planned-sessions">{#each suggestions as suggestion}<option value={suggestion}></option>{/each}</datalist><button type="submit">Add session</button></div>
</form>

<style>
  form { display: grid; gap: 6px; padding: 12px; border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); }
  label { color: var(--text-muted); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
  div { display: flex; gap: 8px; }
  input { flex: 1; }
  button { min-width: 100px; background: var(--accent); color: var(--accent-ink); border-color: transparent; font-weight: 700; }
</style>
