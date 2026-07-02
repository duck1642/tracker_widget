<script>
  import { CheckSquare2, CalendarRange, CalendarDays } from "@lucide/svelte";
  let { currentView, onSelect } = $props();
  const tabs = [
    { id: "todo", label: "Todo", icon: CheckSquare2 },
    { id: "week", label: "Week", icon: CalendarRange },
    { id: "day", label: "Day", icon: CalendarDays }
  ];
</script>

<nav class="main-tabs" aria-label="Main views">
  {#each tabs as tab}
    <button class:active={currentView === tab.id} onclick={() => onSelect(tab.id)}>
      <tab.icon size={15} /><span>{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  .main-tabs { display: flex; gap: 4px; padding: 7px 10px; border-bottom: 1px solid var(--border-color); background: var(--surface-2); }
  button { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 0 14px; border: 0; border-radius: 6px; color: var(--text-muted); background: transparent; cursor: pointer; }
  button:hover { color: var(--text-color); background: var(--surface-hover); }
  button.active { color: var(--accent); background: var(--accent-soft); }
</style>
