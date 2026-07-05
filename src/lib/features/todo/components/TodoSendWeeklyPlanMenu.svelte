<script>
  import { CalendarDays, ListTodo } from "@lucide/svelte";
  import { clampContextMenuPosition } from "$lib/features/todo/todoContextMenuPosition.js";

  let {
    x = 0,
    y = 0,
    plan = [],
    onSelectEntry,
    onEmptyDay
  } = $props();

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let selectedDay = $state(days.find((day) => plan.some((entry) => entry.day === day)) || "Mon");
  let menuElement = $state();
  let menuLeft = $state(0);
  let menuTop = $state(0);

  let entries = $derived(plan.filter((entry) => entry.day === selectedDay));

  $effect(() => {
    const rect = menuElement?.getBoundingClientRect?.();
    const position = clampContextMenuPosition({
      x,
      y,
      width: rect?.width || 236,
      height: rect?.height || 220,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    });
    menuLeft = position.x;
    menuTop = position.y;
  });

  /** @param {string} day */
  function selectDay(day) {
    selectedDay = day;
    if (!plan.some((entry) => entry.day === day)) {
      onEmptyDay?.(day);
    }
  }
</script>

<div
  bind:this={menuElement}
  class="todo-context-menu weekly-plan-picker-menu"
  style:left={`${menuLeft}px`}
  style:top={`${menuTop}px`}
  role="menu"
  aria-label="Choose weekly planned session"
  tabindex="-1"
  oncontextmenu={(event) => event.preventDefault()}
>
  <div class="context-count">Send to weekly planned</div>
  <div class="day-picker" aria-label="Choose day">
    {#each days as day}
      <button type="button" class:active={day === selectedDay} onclick={() => selectDay(day)} title={day}>
        {day}
      </button>
    {/each}
  </div>
  <div class="context-separator" aria-hidden="true"></div>
  {#if entries.length}
    {#each entries as entry (entry.id)}
      <button type="button" role="menuitem" onclick={() => onSelectEntry(entry.id)} title={entry.session}>
        <ListTodo size={13} />
        <span>{entry.session}</span>
      </button>
    {/each}
  {:else}
    <div class="empty-day"><CalendarDays size={13} /> No planned sessions</div>
  {/if}
</div>

<style>
  .weekly-plan-picker-menu {
    width: 236px;
  }

  .day-picker {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 3px;
    padding: 2px;
  }

  .day-picker button {
    justify-content: center;
    min-height: 24px;
    padding: 0;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .day-picker button.active {
    background: var(--surface-hover);
    color: var(--text-color);
  }

  .empty-day {
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 28px;
    padding: 0 7px;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }
</style>
