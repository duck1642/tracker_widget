<script>
  import { tick } from "svelte";
  import { todoStore } from "$lib/features/tasks/todoStore.svelte.js";
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
