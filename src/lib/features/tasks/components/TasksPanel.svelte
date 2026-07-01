<script>
  import { tick } from "svelte";
  import { todoStore } from "$lib/features/tasks/todoStore.svelte.js";
  import { workspaceStore } from "$lib/app/workspaceStore.svelte.js";
  import TaskList from "./TaskList.svelte";

  let focusedTaskId = $state("");
  /** @type {Record<string, string>} */
  let originalTexts = {};

  // Keep a reference to inputs to set focus programmatically
  /** @type {Record<string, HTMLInputElement>} */
  let inputElements = {};

  // Keyboard navigation & editing handlers
  /**
   * @param {KeyboardEvent} event
   * @param {number} index
   * @param {any} task
   */
  async function handleKeyDown(event, index, task) {
    if (event.key === "Backspace" && task.text === "") {
      event.preventDefault();
      let nextFocusId = "";
      for (let i = index - 1; i >= 0; i--) {
        if (todoStore.tasks[i].isTask) {
          nextFocusId = todoStore.tasks[i].id;
          break;
        }
      }
      if (!nextFocusId) {
        for (let i = index + 1; i < todoStore.tasks.length; i++) {
          if (todoStore.tasks[i].isTask) {
            nextFocusId = todoStore.tasks[i].id;
            break;
          }
        }
      }
      delete originalTexts[task.id];
      todoStore.deleteTask(index);
      await tick();
      focusedTaskId = nextFocusId;
      inputElements[nextFocusId]?.focus();
    } else if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        todoStore.outdentTask(task.id);
      } else {
        todoStore.indentTask(task.id);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      const newId = todoStore.addTask(index, task.indent);
      focusedTaskId = newId;
      
      // Auto focus the input element
      await tick();
      if (inputElements[newId]) {
        inputElements[newId].focus();
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      for (let i = index - 1; i >= 0; i--) {
        if (todoStore.tasks[i].isTask) {
          focusedTaskId = todoStore.tasks[i].id;
          if (inputElements[todoStore.tasks[i].id]) {
            inputElements[todoStore.tasks[i].id].focus();
          }
          break;
        }
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      for (let i = index + 1; i < todoStore.tasks.length; i++) {
        if (todoStore.tasks[i].isTask) {
          focusedTaskId = todoStore.tasks[i].id;
          if (inputElements[todoStore.tasks[i].id]) {
            inputElements[todoStore.tasks[i].id].focus();
          }
          break;
        }
      }
    } else if (event.key === "Escape") {
      if (event.target instanceof HTMLElement) {
        event.target.blur();
      }
    }
  }
</script>

{#if todoStore.fileMissing}
  <div class="empty">
    <strong>No todo.md found</strong>
    {#if workspaceStore.workspaceAvailable}
      <span>Create a workspace todo file or import an existing Markdown file.</span>
      <div class="empty-actions">
        <button onclick={() => workspaceStore.createTodo()}>Create todo.md</button>
        <button onclick={() => workspaceStore.importTodo()}>Import Markdown</button>
      </div>
    {:else}
      <span>Select a workspace folder before creating todo.md.</span>
      <button onclick={() => workspaceStore.chooseRoot()}>Select workspace</button>
    {/if}
  </div>
{:else}
  <TaskList 
    tasks={todoStore.tasks}
    inputElements={inputElements}
    onToggleTask={(/** @type {string} */ id) => todoStore.toggleTask(id)}
    onUpdateText={(/** @type {string} */ id, /** @type {string} */ text) => todoStore.updateText(id, text)}
    onMoveTaskUp={(/** @type {number} */ index) => todoStore.moveTaskUp(index)}
    onMoveTaskDown={(/** @type {number} */ index) => todoStore.moveTaskDown(index)}
    onDeleteTask={(/** @type {number} */ index) => todoStore.deleteTask(index)}
    onFocus={(/** @type {string} */ id, /** @type {string} */ text) => {
      focusedTaskId = id;
      originalTexts[id] = text;
    }}
    onBlur={(/** @type {string} */ id, /** @type {string} */ text) => {
      if (focusedTaskId === id) {
        focusedTaskId = "";
      }
      const oldText = originalTexts[id];
      if (oldText !== undefined && oldText !== text) {
        todoStore.commitTextEdit(id, oldText, text);
      }
      delete originalTexts[id];
      void todoStore.flushSave();
    }}
    onKeyDown={handleKeyDown}
  />
{/if}

<style>
  .empty button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 34px;
    padding: 0 16px;
    border: 1px solid var(--border-color);
    border-radius: 5px;
    background: var(--surface-2);
    color: var(--text-color);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 500;
    margin-top: 16px;
  }
  .empty-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .empty-actions button {
    margin-top: 16px;
  }
  .empty button:hover {
    border-color: var(--border-strong);
    background: var(--surface-hover);
  }
</style>
