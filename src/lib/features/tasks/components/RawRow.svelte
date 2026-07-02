<script>
  import { Trash2 } from "@lucide/svelte";

  let { rawLine, index, onDeleteTodo } = $props();
</script>

<div class="raw-row">
  <span class="raw-text">{rawLine.raw}</span>
  <div class="row-actions">
    <button class="row-btn del" onclick={() => onDeleteTodo(index)} title="Delete">
      <Trash2 size={13} />
    </button>
  </div>
</div>
