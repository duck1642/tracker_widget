<script>
  // @ts-nocheck
  import { Check, FolderOpen, ScanSearch, ShieldCheck } from "@lucide/svelte";
  import { workspaceStore } from "./workspaceStore.svelte.js";
  let { pathInputVal = $bindable(), logsRootPath = "", dragEnabled, autostartEnabled, onSave, onCancel, onToggleDrag, onToggleAutostart } = $props();
</script>

<div class="settings-panel">
  <header><div><span>Application</span><h2>Settings</h2></div></header>
  <section>
    <h3>Todo document</h3>
    <label for="path-input">Markdown file</label>
    <input id="path-input" class="settings-input" bind:value={pathInputVal} placeholder="C:\...\todo.md" />
    <button class="primary-small" onclick={onSave}>Save todo path</button>
  </section>
  <section>
    <h3>Logger workspace</h3>
    <span class="field-label">Logs folder</span>
    <div class="path-display"><code>{logsRootPath || "No folder selected"}</code><button onclick={() => workspaceStore.chooseRoot()}><FolderOpen size={14} /> Select</button></div>
  </section>
  <section>
    <h3>Window</h3>
    <button class="toggle-row" onclick={onToggleDrag}><span class:checked={dragEnabled} class="checkbox">{#if dragEnabled}<Check size={11} />{/if}</span>Window dragging</button>
    <button class="toggle-row" onclick={onToggleAutostart}><span class:checked={autostartEnabled} class="checkbox">{#if autostartEnabled}<Check size={11} />{/if}</span>Start on boot</button>
  </section>
  <section>
    <h3>Legacy migration</h3>
    <p>Dry-run recognized daily logs before writing. Migration creates timestamped backups first.</p>
    <div class="migration-actions"><button onclick={() => workspaceStore.dryRunMigration()}><ScanSearch size={14} /> Dry run</button>{#if workspaceStore.migrationReport?.migratable > 0}<button class="primary-small" onclick={() => workspaceStore.applyMigration()}><ShieldCheck size={14} /> Migrate safe files</button>{/if}</div>
    {#if workspaceStore.migrationReport}<div class="report"><span>{workspaceStore.migrationReport.current} current</span><span>{workspaceStore.migrationReport.migratable} migratable</span><span>{workspaceStore.migrationReport.ambiguous} need review</span>{#if workspaceStore.migrationReport.backup}<code>{workspaceStore.migrationReport.backup}</code>{/if}</div>{/if}
  </section>
</div>

<style>
  .settings-panel { display: grid; grid-template-columns: repeat(2, minmax(260px, 1fr)); gap: 12px; width: min(100%, 900px); margin: 0 auto; padding: 22px; box-sizing: border-box; }
  header { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: end; }
  header span { color: var(--accent); font-size: var(--text-xs); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
  h2 { margin: 4px 0 0; } h3 { margin: 0 0 12px; font-size: var(--text-md); }
  section { display: grid; align-content: start; gap: 8px; padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--surface); }
  label, p { color: var(--text-muted); font-size: var(--text-sm); }
  .path-display { display: flex; gap: 8px; align-items: center; min-width: 0; } .path-display code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: var(--text-xs); } .path-display button { flex-shrink: 0; }
  button { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 0 10px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-color); cursor: pointer; }
  button:hover { border-color: var(--border-strong); background: var(--surface-hover); }
  .toggle-row { justify-content: flex-start; border: 0; background: transparent; }
  .checkbox { display: grid; place-items: center; width: 16px; height: 16px; border: 1px solid var(--border-strong); border-radius: 4px; } .checkbox.checked { background: var(--accent); color: var(--accent-ink); }
  .migration-actions { display: flex; gap: 8px; }
  .report { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 6px; } .report span { padding: 4px 7px; border-radius: 4px; background: var(--surface-2); color: var(--text-muted); font-size: var(--text-xs); } .report code { width: 100%; color: var(--success); }
  @media (max-width: 760px) { .settings-panel { grid-template-columns: 1fr; } }
</style>
