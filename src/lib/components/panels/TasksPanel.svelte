<script>
  import { tick } from "svelte";
  import { documentStore } from "$lib/stores/documentStore.js";
  import TaskList from "../TaskList.svelte";

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
    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        documentStore.outdentTask(task.id);
      } else {
        documentStore.indentTask(task.id);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      const newId = documentStore.addTask(index, task.indent);
      focusedTaskId = newId;
      
      // Auto focus the input element
      await tick();
      if (inputElements[newId]) {
        inputElements[newId].focus();
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      for (let i = index - 1; i >= 0; i--) {
        if (documentStore.tasks[i].isTask) {
          focusedTaskId = documentStore.tasks[i].id;
          if (inputElements[documentStore.tasks[i].id]) {
            inputElements[documentStore.tasks[i].id].focus();
          }
          break;
        }
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      for (let i = index + 1; i < documentStore.tasks.length; i++) {
        if (documentStore.tasks[i].isTask) {
          focusedTaskId = documentStore.tasks[i].id;
          if (inputElements[documentStore.tasks[i].id]) {
            inputElements[documentStore.tasks[i].id].focus();
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
  tasks={documentStore.tasks}
  inputElements={inputElements}
  onToggleTask={(/** @type {string} */ id) => documentStore.toggleTask(id)}
  onUpdateText={(/** @type {string} */ id, /** @type {string} */ text) => documentStore.updateText(id, text)}
  onMoveTaskUp={(/** @type {number} */ index) => documentStore.moveTaskUp(index)}
  onMoveTaskDown={(/** @type {number} */ index) => documentStore.moveTaskDown(index)}
  onDeleteTask={(/** @type {number} */ index) => documentStore.deleteTask(index)}
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
      documentStore.logAction({ type: "edit", id, oldText, newText: text });
    }
    delete originalTexts[id];
  }}
  onKeyDown={handleKeyDown}
/>
