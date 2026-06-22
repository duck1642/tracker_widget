<script>
  // @ts-nocheck
  import { ChevronDown, ChevronRight, FileText, CalendarDays } from "@lucide/svelte";
  let { weeks = [], selectedPath = "", onSelectWeek, onSelectDay } = $props();
  let expanded = $state({});
</script>

<nav class="file-tree" aria-label="Log files">
  {#each weeks as week (week.path)}
    <section>
      <button class="week-row" onclick={() => expanded[week.path] = !(expanded[week.path] ?? true)} aria-expanded={expanded[week.path] ?? true}>
        {#if expanded[week.path] ?? true}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
        <span>{week.name}</span>
      </button>
      {#if expanded[week.path] ?? true}
        <div class="children">
          {#if week.indexPath}
            <button class:active={selectedPath === week.indexPath} onclick={() => onSelectWeek(week)}>
              <CalendarDays size={13} /><span>Weekly index</span>
            </button>
          {/if}
          {#each week.days as day (day.path)}
            <button class:active={selectedPath === day.path} onclick={() => onSelectDay(day, week)}>
              <FileText size={13} /><span>{day.date}</span>
            </button>
          {/each}
        </div>
      {/if}
    </section>
  {/each}
  {#if weeks.length === 0}<p>No log weeks yet.</p>{/if}
</nav>

<style>
  .file-tree { display: grid; align-content: start; gap: 2px; padding: 5px 7px 8px; overflow: auto; scrollbar-width: none; }
  .file-tree::-webkit-scrollbar { width: 0; height: 0; }
  section { display: grid; gap: 1px; }
  button { display: flex; align-items: center; gap: 7px; width: 100%; min-height: 28px; border: 0; border-radius: 5px; background: transparent; color: var(--text-muted); text-align: left; cursor: pointer; }
  button:hover { background: var(--surface-hover); color: var(--text-color); }
  button.active { background: var(--accent-soft); color: var(--accent); }
  .week-row { color: var(--text-color); font-weight: 650; }
  .children { display: grid; gap: 1px; padding-left: 18px; }
  p { padding: 12px; color: var(--text-muted); font-size: var(--text-sm); }
</style>
