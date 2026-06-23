<script>
  import { Clock3 } from "@lucide/svelte";
  let { date, totalMinutes, saving = false } = $props();
  let displayDate = $derived(date ? new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "Select a daily log");
</script>

<header>
  <div><h1>{displayDate}</h1></div>
  <div class="total"><Clock3 size={17} /><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong><span>{saving ? "Saving…" : `${totalMinutes} minutes`}</span></div>
</header>

<style>
  header { position: sticky; top: 0; z-index: 5; display: flex; align-items: end; justify-content: space-between; gap: 20px; padding: 22px 0 14px; background: var(--bg-panel); }
  h1 { margin: 5px 0 0; font-size: var(--text-xl); line-height: 1.15; }
  .total { display: grid; grid-template-columns: auto auto; align-items: center; gap: 1px 7px; color: var(--accent); text-align: right; }
  .total span { grid-column: 2; color: var(--text-muted); font-size: var(--text-xs); }
</style>
