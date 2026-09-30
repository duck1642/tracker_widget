<script>
  let { onReloadExternal, onKeepLocal } = $props();
</script>

<div class="conflict-banner" role="alert">
  <span>The file changed externally. Reload the external version or keep your local changes.</span>
  <div class="conflict-actions">
    <button class="action-btn" onclick={onReloadExternal}>Reload External</button>
    <button class="action-btn" onclick={onKeepLocal}>Keep Local</button>
  </div>
</div>

<style>
  .conflict-banner {
    box-sizing: border-box;
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    min-width: 0;
    margin: 8px;
    padding: 10px;
    border: 1px solid rgba(255, 190, 80, 0.45);
    border-radius: 6px;
    background: rgba(120, 75, 10, 0.28);
    color: #ffd99a;
    font-size: 11px;
    line-height: 1.5;
  }

  .conflict-banner > span {
    flex: 1 1 280px;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .conflict-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
    margin-left: auto;
  }

  .conflict-actions .action-btn {
    box-sizing: border-box;
    max-width: 100%;
    padding: 5px 8px;
    font-size: 11px;
    white-space: normal;
    overflow-wrap: anywhere;
  }
</style>
