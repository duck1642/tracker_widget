<script>
  import { X } from "@lucide/svelte";
  let { onClose } = $props();
</script>

<svelte:window onkeydown={(event) => { if (event.key === "Escape") onClose?.(); }} />

<div class="dialog-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
  <div class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
    <header>
      <div><span>Tracker Widget</span><h2 id="help-title">Keyboard shortcuts</h2></div>
      <button type="button" onclick={onClose} aria-label="Close Help" title="Close"><X size={15} /></button>
    </header>
    <dl>
      <div><dt>Back</dt><dd><kbd>Alt</kbd><kbd>←</kbd></dd></div>
      <div><dt>Forward</dt><dd><kbd>Alt</kbd><kbd>→</kbd></dd></div>
      <div><dt>Previous log file</dt><dd><kbd>Ctrl</kbd><kbd>Page Up</kbd></dd></div>
      <div><dt>Next log file</dt><dd><kbd>Ctrl</kbd><kbd>Page Down</kbd></dd></div>
    </dl>
    <p>Back and Forward follow your navigation history. Page Up and Page Down move through files in sidebar order.</p>
  </div>
</div>

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 32px 0 0;
    z-index: var(--layer-modal);
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.46);
    box-sizing: border-box;
  }
  .help-dialog {
    width: min(430px, 100%);
    overflow: hidden;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    background: var(--bg-panel);
    box-shadow: 0 22px 70px rgba(0, 0, 0, 0.42);
  }
  header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border-subtle); background: var(--surface); }
  header span { color: var(--accent); font-size: var(--text-xs); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
  h2 { margin: 3px 0 0; font-size: var(--text-lg); }
  button { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); cursor: pointer; }
  button:hover { color: #ff5555; background: transparent; }
  dl { display: grid; gap: 1px; margin: 0; padding: 12px 18px; }
  dl div { display: flex; align-items: center; justify-content: space-between; min-height: 38px; border-bottom: 1px solid var(--border-subtle); }
  dl div:last-child { border-bottom: 0; }
  dt { color: var(--text-color); font-size: var(--text-sm); }
  dd { display: flex; gap: 4px; margin: 0; }
  kbd { min-width: 24px; padding: 3px 6px; border: 1px solid var(--border-color); border-bottom-color: var(--border-strong); border-radius: 4px; background: var(--surface-2); color: var(--text-muted); font: 10px/1.3 ui-monospace, monospace; text-align: center; }
  p { margin: 0; padding: 0 18px 18px; color: var(--text-muted); font-size: var(--text-xs); line-height: 1.5; }
</style>
