<script>
  // @ts-nocheck
  import { Check, FolderOpen, FileText } from "@lucide/svelte";
  import { workspaceStore } from "./workspaceStore.svelte.js";
  import { todoStore } from "$lib/features/tasks/todoStore.svelte.js";
  import { appStore } from "./appStore.svelte.js";
  let { dragEnabled, autostartEnabled, onToggleDrag, onToggleAutostart } = $props();
</script>

<div class="settings-panel">
  <header><div><span>Application</span><h2>Settings</h2></div></header>
  <section>
    <h3>Todo document</h3>
    <span class="field-label">Markdown file</span>
    <div class="path-display"><code>{appStore.filePath || "No file selected"}</code><button onclick={() => todoStore.chooseFile()}><FileText size={14} /> Select</button></div>
  </section>
  <section>
    <h3>Logger workspace</h3>
    <span class="field-label">Logs folder</span>
    <div class="path-display"><code>{appStore.logsRootPath || "No folder selected"}</code><button onclick={() => workspaceStore.chooseRoot()}><FolderOpen size={14} /> Select</button></div>
  </section>
  <section>
    <h3>Window</h3>
    <button class="toggle-row" onclick={onToggleDrag}><span class:checked={dragEnabled} class="checkbox">{#if dragEnabled}<Check size={11} />{/if}</span>Window dragging</button>
    <button class="toggle-row" onclick={onToggleAutostart}><span class:checked={autostartEnabled} class="checkbox">{#if autostartEnabled}<Check size={11} />{/if}</span>Start on boot</button>
  </section>
</div>

<style>
  .settings-panel { display: grid; grid-template-columns: repeat(2, minmax(260px, 1fr)); gap: 12px; width: min(100%, 900px); margin: 0 auto; padding: 22px; box-sizing: border-box; }
  header { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: end; }
  header span { color: var(--accent); font-size: var(--text-xs); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
  h2 { margin: 4px 0 0; } h3 { margin: 0 0 12px; font-size: var(--text-md); }
  section { display: grid; align-content: start; gap: 8px; padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--surface); }
  .field-label { color: var(--text-muted); font-size: var(--text-sm); }
  .path-display { display: flex; gap: 8px; align-items: center; min-width: 0; } .path-display code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: var(--text-xs); } .path-display button { flex-shrink: 0; }
  button { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 0 10px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-color); cursor: pointer; }
  button:hover { border-color: var(--border-strong); background: var(--surface-hover); }
  .toggle-row { justify-content: flex-start; border: 0; background: transparent; }
  .checkbox { display: grid; place-items: center; width: 16px; height: 16px; border: 1px solid var(--border-strong); border-radius: 4px; } .checkbox.checked { background: var(--accent); color: var(--accent-ink); }
  @media (max-width: 760px) { .settings-panel { grid-template-columns: 1fr; } }
</style>
