<script>
  import { CalendarDays, Clock3 } from "@lucide/svelte";
  let { date, totalMinutes, saving = false } = $props();
  let displayDate = $derived(date ? new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "Select a daily log");
</script>

<header>
  <div><span class="eyebrow"><CalendarDays size={13} /> Daily log</span><h1>{displayDate}</h1></div>
  <div class="total"><Clock3 size={17} /><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong><span>{saving ? "Saving…" : `${totalMinutes} minutes`}</span></div>
</header>

<style>
  header { display: flex; align-items: end; justify-content: space-between; gap: 20px; padding-bottom: 4px; }
  .eyebrow { display: flex; align-items: center; gap: 5px; color: var(--accent); font-size: var(--text-xs); font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  h1 { margin: 5px 0 0; font-size: var(--text-xl); line-height: 1.15; }
  .total { display: grid; grid-template-columns: auto auto; align-items: center; gap: 1px 7px; color: var(--accent); text-align: right; }
  .total span { grid-column: 2; color: var(--text-muted); font-size: var(--text-xs); }
</style>
