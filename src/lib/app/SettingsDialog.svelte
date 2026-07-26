<script>
  import { X } from "@lucide/svelte";
  import SettingsPanel from "./SettingsPanel.svelte";

  let {
    dragEnabled,
    autostartEnabled,
    onToggleDrag,
    onToggleAutostart,
    onClose
  } = $props();
</script>

<svelte:window onkeydown={(event) => { if (event.key === "Escape") onClose?.(); }} />

<div class="dialog-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
  <div class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <header>
      <div><span>Application</span><h2 id="settings-title">Settings</h2></div>
      <button type="button" class="close-button" onclick={onClose} aria-label="Close Settings" title="Close"><X size={15} /></button>
    </header>
    <div class="dialog-content">
      <SettingsPanel {dragEnabled} {autostartEnabled} {onToggleDrag} {onToggleAutostart} />
    </div>
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
  .settings-dialog {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: min(840px, 100%);
    max-height: min(660px, 100%);
    overflow: hidden;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    background: var(--bg-panel);
    box-shadow: 0 22px 70px rgba(0, 0, 0, 0.42);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface);
  }
  header span { color: var(--accent); font-size: var(--text-xs); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
  h2 { margin: 3px 0 0; font-size: var(--text-lg); }
  .close-button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }
  .close-button:hover { color: #ff5555; background: transparent; }
  .dialog-content { min-height: 0; overflow: auto; scrollbar-width: none; }
  .dialog-content::-webkit-scrollbar { display: none; }
</style>
