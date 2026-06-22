<script>
  import TaskRow from "./TaskRow.svelte";
  import RawRow from "./RawRow.svelte";

  let { 
    tasks, 
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
</script>

<div class="task-list">
  {#each tasks as task, index (task.id)}
    {#if task.isTask}
      <TaskRow 
        task={task} 
        index={index} 
        inputElements={inputElements}
        onToggleTask={onToggleTask}
        onUpdateText={onUpdateText}
        onMoveTaskUp={onMoveTaskUp}
        onMoveTaskDown={onMoveTaskDown}
        onDeleteTask={onDeleteTask}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    {:else}
      {#if task.raw.trim().length > 0}
        <RawRow 
          task={task} 
          index={index} 
          onDeleteTask={onDeleteTask} 
        />
      {/if}
    {/if}
  {/each}

  {#if tasks.length === 0}
    <div class="empty-state">
      No tasks. Press [+] below to start.
    </div>
  {/if}
</div>
