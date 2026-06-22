<script>
  import { Trash2 } from "@lucide/svelte";

  let { task, index, onDeleteTask } = $props();
</script>

<div class="raw-row">
  <span class="raw-text">{task.raw}</span>
  <div class="row-actions">
    <button class="row-btn del" onclick={() => onDeleteTask(index)} title="Delete">
      <Trash2 size={13} />
    </button>
  </div>
</div>
