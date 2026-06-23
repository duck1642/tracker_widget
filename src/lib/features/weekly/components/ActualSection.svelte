<script>
  import { RefreshCw } from "@lucide/svelte";
  let { actual, onRefresh } = $props();
</script>

<section id="actual" class="week-section">
  <header><div><h2>Weekly actual</h2></div><button type="button" class="refresh-btn" onclick={onRefresh} title="Refresh actual logs"><RefreshCw size={12} /> Refresh</button></header>
  <div class="actual-grid"><div class="table-head"><span>Day</span><span>Session</span><span>Subjects</span><span>Minutes</span></div>{#each actual as entry}<div class="actual-row"><strong>{entry.day}</strong><span>{entry.session}</span><span class="subjects">{entry.subjects.join(", ")}</span><strong>{entry.actualMinutes}m</strong></div>{/each}{#if actual.length === 0}<p class="empty-copy">No recorded sessions.</p>{/if}</div>
</section>

<style>
  .actual-grid { border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; }
  .table-head, .actual-row { display: grid; grid-template-columns: 70px 1fr 1.4fr 90px; gap: 12px; align-items: center; min-height: 38px; padding: 0 12px; }
  .table-head { background: var(--surface-2); color: var(--text-muted); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
  .actual-row { border-top: 1px solid var(--border-subtle); }
  .subjects { color: var(--text-muted); }
  .refresh-btn { display: inline-flex; align-items: center; justify-content: center; gap: 3px; height: 28px; padding: 0 12px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--surface-2); color: var(--text-muted); font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
  .refresh-btn:hover { background: var(--surface-hover); color: var(--text-color); border-color: var(--border-strong); }
</style>
