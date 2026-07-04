<script>
  // @ts-nocheck
  import { Check, FolderOpen, FilePlus, RefreshCw, Upload } from "@lucide/svelte";
  import { workspaceStore } from "./workspaceStore.svelte.js";
  import { appStore } from "./appStore.svelte.js";
  import { subjectHistoryStore } from "./subjectHistoryStore.svelte.js";
  let { dragEnabled, autostartEnabled, onToggleDrag, onToggleAutostart } = $props();
</script>

<div class="settings-panel">
  <header><div><span>Application</span><h2>Settings</h2></div></header>
  <section>
    <h3>Workspace folder</h3>
    <span class="field-label">Folder</span>
    <div class="path-display"><code title={appStore.logsRootPath || "No folder selected"}>{appStore.logsRootPath || "No folder selected"}</code><button onclick={() => workspaceStore.chooseRoot()}><FolderOpen size={14} /> Select</button></div>
    <span class="field-label">Todo file</span>
    <div class="path-display"><code title={workspaceStore.todoPath || "No workspace selected"}>{workspaceStore.todoPath || "No workspace selected"}</code><span class:ok={workspaceStore.todoExists} class="status-pill">{workspaceStore.todoExists ? "Found" : "Missing"}</span></div>
    {#if workspaceStore.workspaceAvailable && !workspaceStore.todoExists}
      <div class="settings-actions">
        <button onclick={() => workspaceStore.createTodo()}><FilePlus size={14} /> Create todo.md</button>
        <button onclick={() => workspaceStore.importTodo()}><Upload size={14} /> Import Markdown</button>
      </div>
    {/if}
  </section>
  <section>
    <h3>Window</h3>
    <button class="toggle-row" onclick={onToggleDrag}><span class:checked={dragEnabled} class="checkbox">{#if dragEnabled}<Check size={11} />{/if}</span>Window dragging</button>
    <button class="toggle-row" onclick={onToggleAutostart}><span class:checked={autostartEnabled} class="checkbox">{#if autostartEnabled}<Check size={11} />{/if}</span>Start on boot</button>
  </section>
  <section>
    <h3>Frontmatter</h3>
    <button class="toggle-row" onclick={() => appStore.changeFrontmatterMode("off")}><span class:checked={appStore.frontmatterMode === "off"} class="checkbox">{#if appStore.frontmatterMode === "off"}<Check size={11} />{/if}</span>Off</button>
    <button class="toggle-row" onclick={() => appStore.changeFrontmatterMode("personal")}><span class:checked={appStore.frontmatterMode === "personal"} class="checkbox">{#if appStore.frontmatterMode === "personal"}<Check size={11} />{/if}</span>Personal</button>
  </section>
  <section>
    <h3>Subject history</h3>
    <span class="field-label">{subjectHistoryStore.suggestions.length} {subjectHistoryStore.suggestions.length === 1 ? "subject" : "subjects"}</span>
    <button onclick={() => subjectHistoryStore.rebuild(appStore.logsRootPath)} disabled={subjectHistoryStore.rebuilding}>
      <RefreshCw size={14} /> {subjectHistoryStore.rebuilding ? "Rebuilding..." : "Rebuild subject history"}
    </button>
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
  .status-pill { flex-shrink: 0; min-width: 54px; padding: 4px 7px; border: 1px solid var(--border-color); border-radius: 999px; color: var(--warning); font-size: var(--text-xs); text-align: center; }
  .status-pill.ok { color: var(--success); }
  button { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 0 10px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-color); cursor: pointer; }
  button:hover { border-color: var(--border-strong); background: var(--surface-hover); }
  .toggle-row { justify-content: flex-start; border: 0; background: transparent; }
  .checkbox { display: grid; place-items: center; width: 16px; height: 16px; border: 1px solid var(--border-strong); border-radius: 4px; } .checkbox.checked { background: var(--accent); color: var(--accent-ink); }
  @media (max-width: 760px) { .settings-panel { grid-template-columns: 1fr; } }
</style>
