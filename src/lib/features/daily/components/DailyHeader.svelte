<script>
  import { Clock3 } from "@lucide/svelte";
  import { formatDurationSummary } from "$lib/shared/utils/durationSummary.js";
  let { date, totalMinutes, unknownDurationCount = 0 } = $props();
  let displayDate = $derived(date ? new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "Select a daily log");
  let totalLabel = $derived(formatDurationSummary({ knownMinutes: totalMinutes, unknownCount: unknownDurationCount }, { hours: true }));
</script>

<header>
  <div><h1>{displayDate}</h1></div>
  <div class="total">
    <div class="total-value"><Clock3 size={17} /><strong>{totalLabel}</strong></div>
    <span>{totalMinutes}{unknownDurationCount ? " known" : ""} minutes</span>
  </div>
</header>

<style>
  header { position: sticky; top: 0; z-index: var(--layer-sticky-header); display: flex; align-items: end; justify-content: space-between; gap: 20px; padding: 22px 0 14px; background: var(--bg-panel); }
  h1 { margin: 5px 0 0; font-size: var(--text-xl); line-height: 1.15; }
  .total { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; color: var(--accent); text-align: right; }
  .total-value { display: inline-flex; align-items: center; gap: 7px; }
  .total span { color: var(--text-muted); font-size: var(--text-xs); }
</style>
