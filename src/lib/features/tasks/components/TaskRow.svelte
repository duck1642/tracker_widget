<script>
  import { Check, ChevronUp, ChevronDown, Trash2 } from "@lucide/svelte";

  let { 
    task, 
    index, 
    inputElements, 
    onToggleTask, 
    onUpdateText, 
    onMoveTaskUp, 
    onMoveTaskDown, 
    onDeleteTask, 
    onFocus, 
    onBlur, 
    onKeyDown 
  } = $props();

  let inputEl = $state();

  // Create a single offscreen canvas to measure text widths efficiently
  const canvas = typeof document !== 'undefined' ? document.createElement("canvas") : null;

  /** @param {string} text */
  function measureTextWidth(text) {
    if (!canvas) return 150;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 150;
    ctx.font = "13px 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, Roboto, sans-serif";
    return ctx.measureText(text || "").width;
  }

  let measuredWidth = $derived(measureTextWidth(task.text));

  $effect(() => {
    if (inputEl && inputElements) {
      inputElements[task.id] = inputEl;
    }
    return () => {
      if (inputElements) {
        delete inputElements[task.id];
      }
    };
  });
</script>

<div class="task-row" style="padding-left: {task.indent * 16}px">
  <button 
    type="button"
    class="custom-check-btn {task.checked ? 'checked' : ''}" 
    onclick={() => onToggleTask(task.id)}
    title={task.checked ? "Mark active" : "Mark completed"}
  >
    {#if task.checked}
      <Check size={10} strokeWidth={4} />
    {/if}
  </button>
  <input 
    type="text" 
    class="task-text {task.checked ? 'completed' : ''}" 
    style="min-width: {Math.max(150, measuredWidth + 12)}px"
    value={task.text}
    bind:this={inputEl}
    onfocus={() => onFocus(task.id, task.text)}
    onblur={() => onBlur(task.id, task.text)}
    oninput={(e) => onUpdateText(task.id, e.currentTarget.value)}
    onkeydown={(e) => onKeyDown(e, index, task)}
    placeholder="New Task..."
  />
  <div class="row-actions">
    <button class="row-btn" onclick={() => onMoveTaskUp(index)} title="Move Up">
      <ChevronUp size={13} />
    </button>
    <button class="row-btn" onclick={() => onMoveTaskDown(index)} title="Move Down">
      <ChevronDown size={13} />
    </button>
    <button class="row-btn del" onclick={() => onDeleteTask(index)} title="Delete">
      <Trash2 size={13} />
    </button>
  </div>
</div>
