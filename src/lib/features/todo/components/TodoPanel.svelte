<script lang="ts">
import type { TodoItem } from "../types.ts";
import type { DailySession } from "$lib/features/daily/types.ts";
import type { PlanEntry } from "$lib/features/weekly/types.ts";
import type { LogDayEntry } from "$lib/shared/services/types.ts";
  import { tick } from "svelte";
  import { appStore } from "$lib/app/appStore.svelte.ts";
  import { dailyStore as defaultDailyStore } from "$lib/features/daily/dailyStore.svelte.ts";
  import { todoStore as defaultTodoStore } from "$lib/features/todo/todoStore.svelte.ts";
  import { buildVisibleTodoRows, todoFoldStore } from "$lib/features/todo/todoFolding.svelte.ts";
  import { todoUiState } from "$lib/features/todo/todoUiState.svelte.ts";
  import { weekStore as defaultWeekStore } from "$lib/features/weekly/weekStore.svelte.ts";
  import { workspaceStore } from "$lib/app/workspaceStore.svelte.ts";
  import { formatDate, getWeekDescriptor } from "$lib/shared/services/logWorkspaceService.ts";
  import TodoList from "./TodoList.svelte";
  import ContextMenu from "$lib/shared/components/ContextMenu.svelte";
  import { CheckSquare2, ChevronDown, ChevronUp, ClipboardList, Flag, IndentDecrease, IndentIncrease, ListTodo, Square, Trash2, X, Terminal } from "@lucide/svelte";
  import { captureEditableText } from "$lib/shared/services/editableTextClipboard.ts";
  import { buildEditableTextMenuItems } from "$lib/shared/services/editableTextMenuItems.ts";
  import { invoke } from "@tauri-apps/api/core";
  import TodoSendSessionMenu from "./TodoSendSessionMenu.svelte";
  import TodoSendWeeklyPlanMenu from "./TodoSendWeeklyPlanMenu.svelte";
  let { todoStore = defaultTodoStore, dailyStore = defaultDailyStore, weekStore = defaultWeekStore }: {
      todoStore?: typeof defaultTodoStore;
      dailyStore?: typeof defaultDailyStore;
      weekStore?: typeof defaultWeekStore;
  } = $props();

  let focusedTodoId = $state("");

  let contextMenu: {

      x: number;

      y: number;

      editable: ReturnType<typeof captureEditableText>;

  } | null = $state(null);

  let sessionMenu: {

      x: number;

      y: number;

      sessions: DailySession[];

  } | null = $state(null);

  let weeklyPlanMenu: {

      x: number;

      y: number;

      plan: PlanEntry[];

  } | null = $state(null);

  let originalTexts: Record<string, string> = {};

  export type ContextMenuItem = import("$lib/shared/components/types.ts").MenuItem;

  let contextMenuItems = $derived.by(() => {
    if (!contextMenu) return [];
    const selectedCount = todoUiState.selectedTodoIds.length;
    const editable = contextMenu.editable;

    const items: ContextMenuItem[] = [
      { label: `${selectedCount} selected`, isHeader: true }
    ];

    items.push(...buildEditableTextMenuItems(editable, {
      beforeAction: () => {
        closeContextMenu();
        todoUiState.clearSelection();
      },
      onError: (error) => appStore.showStatus(`Clipboard failed: ${error}`)
    }));

    items.push(
      {
        label: "Send to today's activity",
        icon: ClipboardList,
        onclick: handleOpenTodayActivitySessions
      },
      {
        label: "Send to weekly objective",
        icon: Flag,
        onclick: handleSendToWeeklyObjective
      },
      {
        label: "Send to weekly planned",
        icon: ListTodo,
        onclick: handleOpenWeeklyPlannedSessions
      },
      { separator: true },
      {
        label: "Check selected",
        icon: CheckSquare2,
        onclick: () => handleSetSelectedChecked(true)
      },
      {
        label: "Uncheck selected",
        icon: Square,
        onclick: () => handleSetSelectedChecked(false)
      },
      {
        label: "Indent selected",
        icon: IndentIncrease,
        onclick: () => handleShiftSelectedIndent(1)
      },
      {
        label: "Outdent selected",
        icon: IndentDecrease,
        onclick: () => handleShiftSelectedIndent(-1)
      }
    );

    if (selectedCount === 1) {
      items.push(
        {
          label: "Move Up",
          icon: ChevronUp,
          onclick: () => handleMoveSelected(-1)
        },
        {
          label: "Move Down",
          icon: ChevronDown,
          onclick: () => handleMoveSelected(1)
        }
      );
    }

    items.push(
      { separator: true },
      {
        label: "Delete selected",
        icon: Trash2,
        danger: true,
        onclick: handleDeleteSelected
      },
      {
        label: "Clear selection",
        icon: X,
        onclick: handleClearSelectionFromMenu
      }
    );

    if (appStore.devMode) {
      items.push(
        { separator: true },
        {
          label: "Inspect Element",
          icon: Terminal,
          onclick: async () => {
            closeContextMenu();
            try {
              await invoke("toggle_devtools");
            } catch (err) {
              appStore.showStatus("Inspect failed: " + err);
            }
          }
        }
      );
    }

    return items;
  });

  // Keep a reference to inputs to set focus programmatically

  let inputElements: Record<string, HTMLTextAreaElement> = {};
  let visibleTodos = $derived(buildVisibleTodoRows(todoStore.todos, todoFoldStore.foldedTodoIds));
  let visibleTodoRows = $derived(visibleTodos.rows.filter((row) => row.todo.isTodo));
  let visibleTodoIds = $derived(visibleTodoRows.map((row) => row.todo.id));

  $effect(() => {
    todoFoldStore.setFoldableTodoIds(visibleTodos.foldableIds);
  });

  $effect(() => {
    todoUiState.pruneSelection(todoStore.todos.filter((todo) => todo.isTodo).map((todo) => todo.id));
  });

  $effect(() => {
    if (!todoUiState.hasSelection) closeMenus();
  });


  function isVisibleStoreIndex(index: number) {
    return visibleTodos.rows.some((row) => row.storeIndex === index);
  }


  function visiblePositionForStoreIndex(index: number) {
    return visibleTodoRows.findIndex((row) => row.storeIndex === index) + 1;
  }


  function canMoveTodoToVisiblePosition(fromIndex: number, targetPosition: number) {
    const sourcePosition = visiblePositionForStoreIndex(fromIndex);
    return Number.isInteger(targetPosition)
      && sourcePosition >= 1
      && targetPosition >= 1
      && targetPosition <= visibleTodoRows.length
      && targetPosition !== sourcePosition;
  }


  async function moveTodoToVisiblePosition(fromIndex: number, targetPosition: number) {
    if (!canMoveTodoToVisiblePosition(fromIndex, targetPosition)) return false;
    const targetIndex = visibleTodoRows[targetPosition - 1]?.storeIndex;
    const todoId = todoStore.todos[fromIndex]?.id;
    if (typeof targetIndex !== "number" || !todoStore.moveTodoTo(fromIndex, targetIndex)) return false;
    await tick();
    focusedTodoId = todoId;
    inputElements[todoId]?.focus();
    return true;
  }


  function handleSelectTodo(event: MouseEvent, id: string) {
    if (event.shiftKey) {
      todoUiState.selectRange(visibleTodoIds, id);
    } else {
      todoUiState.toggleSelection(id);
    }
  }


  function setSelectionAnchor(id: string) {
    todoUiState.setAnchor(id);
  }

  function clearSelection() {
    todoUiState.clearSelection();
    closeMenus();
  }


  function toggleFold(id: string) {
    clearSelection();
    todoFoldStore.toggleTodo(id);
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function closeSessionMenu() {
    sessionMenu = null;
  }

  function closeWeeklyPlanMenu() {
    weeklyPlanMenu = null;
  }

  function closeMenus() {
    contextMenu = null;
    sessionMenu = null;
    weeklyPlanMenu = null;
  }


  function openContextMenu(event: MouseEvent, id: string) {
    event.preventDefault();
    const editable = captureEditableText(event.target);
    if (!todoUiState.isSelected(id)) {
      todoUiState.setSelection([id], id);
    }
    contextMenu = { x: event.clientX, y: event.clientY, editable };
    sessionMenu = null;
    weeklyPlanMenu = null;
  }

  function handleClearSelectionFromMenu() {
    clearSelection();
  }

  function selectedTodoDescriptions() {
    const selectedIds = new Set(todoUiState.selectedTodoIds);
    return todoStore.todos
      .filter((todo): todo is TodoItem => todo.isTodo && selectedIds.has(todo.id))
      .map((todo) => todo.text.trim())
      .filter(Boolean);
  }

  async function loadCurrentWeek() {
    const descriptor = getWeekDescriptor(new Date());
    let week = workspaceStore.weeks.find((item) => item.name === descriptor.folderName);
    if (!week?.indexPath) {
      await workspaceStore.refresh();
      week = workspaceStore.weeks.find((item) => item.name === descriptor.folderName);
    }
    if (!week?.indexPath) {
      appStore.showStatus("Current week not found");
      return false;
    }
    if (weekStore.path !== week.indexPath) {
      return await weekStore.loadPath(week.indexPath, descriptor, week.days);
    }
    return true;
  }

  async function handleSendToWeeklyObjective() {
    const descriptions = selectedTodoDescriptions();
    closeContextMenu();
    if (!descriptions.length || !(await loadCurrentWeek())) return;
    if (weekStore.addObjectives(descriptions)) {
      appStore.showStatus(`Sent ${descriptions.length} ${descriptions.length === 1 ? "objective" : "objectives"}`);
      clearSelection();
    }
  }

  async function handleOpenTodayActivitySessions() {
    const descriptor = getWeekDescriptor(new Date());
    const today = formatDate(new Date());
    let week = workspaceStore.weeks.find((item) => item.name === descriptor.folderName);
    let day = week?.days.find((item: LogDayEntry) => item.date === today);
    const menuPosition = contextMenu || { x: 0, y: 0 };
    closeContextMenu();
    if (!day?.path) {
      await workspaceStore.refresh();
      week = workspaceStore.weeks.find((item) => item.name === descriptor.folderName);
      day = week?.days.find((item: LogDayEntry) => item.date === today);
    }
    if (!day?.path) {
      appStore.showStatus("Today log not found");
      return;
    }
    if (dailyStore.path !== day.path) {
      const loaded = await dailyStore.loadPath(day.path, today);
      if (!loaded) return;
    }
    if (!dailyStore.sessions.length) {
      appStore.showStatus("Create a session first");
      return;
    }
    sessionMenu = {
      x: menuPosition.x + 12,
      y: menuPosition.y + 12,
      sessions: dailyStore.sessions
    };
  }

  async function handleOpenWeeklyPlannedSessions() {
    const descriptions = selectedTodoDescriptions();
    const menuPosition = contextMenu || { x: 0, y: 0 };
    closeContextMenu();
    if (!descriptions.length || !(await loadCurrentWeek())) return;
    const plan = weekStore.plan.filter((entry) => entry.session?.trim());
    if (!plan.length) {
      appStore.showStatus("No weekly planned sessions");
      return;
    }
    weeklyPlanMenu = {
      x: menuPosition.x + 12,
      y: menuPosition.y + 12,
      plan
    };
  }


  function handleSendToSession(sessionId: string) {
    const descriptions = selectedTodoDescriptions();
    if (dailyStore.addActivities(sessionId, descriptions)) {
      appStore.showStatus(`Sent ${descriptions.length} ${descriptions.length === 1 ? "activity" : "activities"}`);
      clearSelection();
    } else {
      closeSessionMenu();
    }
  }


  function handleSendToWeeklyPlanEntry(entryId: string) {
    const descriptions = selectedTodoDescriptions();
    if (weekStore.addPlanActivities(entryId, descriptions)) {
      appStore.showStatus(`Sent ${descriptions.length} planned ${descriptions.length === 1 ? "activity" : "activities"}`);
      clearSelection();
    } else {
      appStore.showStatus("Weekly planned session not found");
      closeWeeklyPlanMenu();
    }
  }


  function handleEmptyWeeklyPlanDay(day: string) {
    appStore.showStatus(`No planned sessions for ${day}`);
  }


  function handleSetSelectedChecked(checked: boolean) {
    todoStore.setTodosCheckedByIds(todoUiState.selectedTodoIds, checked);
    closeContextMenu();
  }


  function handleShiftSelectedIndent(delta: number) {
    todoStore.shiftTodosIndentByIds(todoUiState.selectedTodoIds, delta);
    closeContextMenu();
  }

  function handleDeleteSelected() {
    if (todoStore.deleteTodosByIds(todoUiState.selectedTodoIds)) {
      clearSelection();
    } else {
      closeContextMenu();
    }
  }


  function handleMoveSelected(direction: -1 | 1) {
    if (todoUiState.selectedTodoIds.length === 1) {
      const id = todoUiState.selectedTodoIds[0];
      const index = todoStore.todos.findIndex((t) => t.id === id);
      const targetIndex = index + direction;
      if (index >= 0 && targetIndex >= 0 && targetIndex < todoStore.todos.length) {
        if (direction === -1) todoStore.moveTodoUp(index);
        else todoStore.moveTodoDown(index);
        focusedTodoId = id;
        tick().then(() => {
          inputElements[id]?.focus();
        });
      }
    }
    closeContextMenu();
  }


  function handleRawContextMenu(event: MouseEvent) {
    event.preventDefault();
    clearSelection();
  }


  function handleBlankContextMenu(event: MouseEvent) {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    clearSelection();
  }

  // Todo keyboard navigation and editing handlers

  async function handleKeyDown(event: KeyboardEvent, index: number, todo: TodoItem) {
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      const sourcePosition = visiblePositionForStoreIndex(index);
      const targetPosition = event.key === "ArrowUp" ? sourcePosition - 1 : sourcePosition + 1;
      if (canMoveTodoToVisiblePosition(index, targetPosition)) {
        event.preventDefault();
        await moveTodoToVisiblePosition(index, targetPosition);
      }
    } else if (event.key === "Backspace" && todo.text === "") {
      event.preventDefault();
      let nextFocusId = "";
      for (let i = index - 1; i >= 0; i--) {
        if (todoStore.todos[i].isTodo && isVisibleStoreIndex(i)) {
          nextFocusId = todoStore.todos[i].id;
          break;
        }
      }
      if (!nextFocusId) {
        for (let i = index + 1; i < todoStore.todos.length; i++) {
          if (todoStore.todos[i].isTodo && isVisibleStoreIndex(i)) {
            nextFocusId = todoStore.todos[i].id;
            break;
          }
        }
      }
      delete originalTexts[todo.id];
      todoStore.deleteTodo(index);
      await tick();
      focusedTodoId = nextFocusId;
      inputElements[nextFocusId]?.focus();
    } else if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        todoStore.outdentTodo(todo.id);
      } else {
        todoStore.indentTodo(todo.id);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      const newId = todoStore.addTodo(index, todo.indent);
      focusedTodoId = newId;

      // Focus the newly inserted todo input.
      await tick();
      if (inputElements[newId]) {
        inputElements[newId].focus();
      }
    } else if (event.key === "ArrowUp") {
      const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null;
      if (!textarea) return;
      const selectionStart = textarea.selectionStart ?? 0;
      if (selectionStart > 0) {
        return;
      }
      event.preventDefault();
      for (let i = index - 1; i >= 0; i--) {
        if (todoStore.todos[i].isTodo && isVisibleStoreIndex(i)) {
          focusedTodoId = todoStore.todos[i].id;
          if (inputElements[todoStore.todos[i].id]) {
            const nextTextarea = inputElements[todoStore.todos[i].id];
            nextTextarea.focus();
            nextTextarea.selectionStart = nextTextarea.selectionEnd = nextTextarea.value.length;
          }
          break;
        }
      }
    } else if (event.key === "ArrowDown") {
      const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null;
      if (!textarea) return;
      const selectionEnd = textarea.selectionEnd ?? 0;
      if (selectionEnd < textarea.value.length) {
        return;
      }
      event.preventDefault();
      for (let i = index + 1; i < todoStore.todos.length; i++) {
        if (todoStore.todos[i].isTodo && isVisibleStoreIndex(i)) {
          focusedTodoId = todoStore.todos[i].id;
          if (inputElements[todoStore.todos[i].id]) {
            const nextTextarea = inputElements[todoStore.todos[i].id];
            nextTextarea.focus();
            nextTextarea.selectionStart = nextTextarea.selectionEnd = 0;
          }
          break;
        }
      }
    } else if (event.key === "Escape") {
      if (contextMenu) {
        event.preventDefault();
        closeContextMenu();
        return;
      }
      if (todoUiState.hasSelection) {
        event.preventDefault();
        todoUiState.clearSelection();
        return;
      }
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
  <TodoList 
    rows={visibleTodos.rows}
    showTodoNumbers={todoUiState.showTodoNumbers}
    selectionActive={todoUiState.hasSelection}
    visiblePositionForStoreIndex={visiblePositionForStoreIndex}
    isTodoSelected={(id) => todoUiState.isSelected(id)}
    inputElements={inputElements}
    onToggleTodo={(id) => todoStore.toggleTodo(id)}
    onUpdateText={(id, text) => todoStore.updateText(id, text)}
    onMoveTodoToVisiblePosition={moveTodoToVisiblePosition}
    onDeleteTodo={(index) => todoStore.deleteTodo(index)}
    onToggleFold={toggleFold}
    onSelectTodo={handleSelectTodo}
    onSetSelectionAnchor={setSelectionAnchor}
    onClearSelection={clearSelection}
    onOpenContextMenu={openContextMenu}
    onRawContextMenu={handleRawContextMenu}
    onBlankContextMenu={handleBlankContextMenu}
    onFocus={(id, text) => {
      focusedTodoId = id;
      originalTexts[id] = text;
    }}
    onBlur={(id, text) => {
      if (focusedTodoId === id) {
        focusedTodoId = "";
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
  {#if contextMenu}
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      items={contextMenuItems}
      ariaLabel="Todo selection actions"
      preserveFocus={Boolean(contextMenu.editable)}
    />
  {/if}
  {#if sessionMenu}
    <TodoSendSessionMenu
      x={sessionMenu.x}
      y={sessionMenu.y}
      sessions={sessionMenu.sessions}
      onSelectSession={handleSendToSession}
    />
  {/if}
  {#if weeklyPlanMenu}
    <TodoSendWeeklyPlanMenu
      x={weeklyPlanMenu.x}
      y={weeklyPlanMenu.y}
      plan={weeklyPlanMenu.plan}
      onSelectEntry={handleSendToWeeklyPlanEntry}
      onEmptyDay={handleEmptyWeeklyPlanDay}
    />
  {/if}
{/if}

<svelte:window
  onpointerdown={(event) => {
    if (!contextMenu && !sessionMenu && !weeklyPlanMenu) return;
    if (event.target instanceof Element && event.target.closest(".todo-context-menu")) return;
    closeMenus();
  }}
  onkeydown={(event) => {
    if ((contextMenu || sessionMenu || weeklyPlanMenu) && event.key === "Escape") {
      event.preventDefault();
      closeMenus();
    }
  }}
  onscrollcapture={() => closeMenus()}
  onwheel={() => closeMenus()}
/>

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
