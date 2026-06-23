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
    value={task.text}
    bind:this={inputEl}
    onfocus={() => onFocus(task.id, task.text)}
    onblur={() => onBlur(task.id, task.text)}
    oninput={(e) => onUpdateText(task.id, e.currentTarget.value)}
    onkeydown={(e) => onKeyDown(e, index, task)}
    placeholder="New Task"
  />
  <div class="row-actions">
    <button type="button" class="row-btn" onpointerdown={(event) => event.preventDefault()} onclick={() => onMoveTaskUp(index)} aria-label="Move task up" title="Move Up">
      <ChevronUp size={13} />
    </button>
    <button type="button" class="row-btn" onpointerdown={(event) => event.preventDefault()} onclick={() => onMoveTaskDown(index)} aria-label="Move task down" title="Move Down">
      <ChevronDown size={13} />
    </button>
    <button type="button" class="row-btn del" onpointerdown={(event) => event.preventDefault()} onclick={() => onDeleteTask(index)} aria-label="Delete task" title="Delete">
      <Trash2 size={13} />
    </button>
  </div>
</div>
