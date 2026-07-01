<script>
  let { onReloadExternal, onKeepLocal } = $props();
</script>

<div class="conflict-banner" role="alert">
  <span>The todo file changed externally.</span>
  <div class="conflict-actions">
    <button class="action-btn" onclick={onReloadExternal}>Reload External</button>
    <button class="action-btn" onclick={onKeepLocal}>Keep Local</button>
  </div>
</div>
