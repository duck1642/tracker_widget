<script>
  // @ts-nocheck
  import { Plus, Trash2 } from "@lucide/svelte";
  import ActivityRow from "./ActivityRow.svelte";
  let { session, onAddActivity, onUpdateActivity, onDeleteActivity, onDeleteSession } = $props();
  let expanded = $state(true);
  let subtotal = $derived(session.activities.reduce((sum, activity) => sum + activity.minutes, 0));
</script>

<article class="session-card">
  <header>
    <button class="session-title" onclick={() => expanded = !expanded} aria-expanded={expanded}><span>{session.name}</span><small>{subtotal}m · {session.activities.length} activities</small></button>
    <button class="icon-button danger" onclick={onDeleteSession} aria-label="Delete session" title="Delete session"><Trash2 size={15} /></button>
  </header>
  {#if expanded}
    <div class="activities">
      {#each session.activities as activity (activity.id)}
        <ActivityRow {activity} onUpdate={(patch) => onUpdateActivity(activity.id, patch)} onDelete={() => onDeleteActivity(activity.id)} />
      {/each}
      {#if session.activities.length === 0}<p>No activities yet.</p>{/if}
    </div>
    <footer><button onclick={onAddActivity}><Plus size={14} /> Add activity</button></footer>
  {/if}
</article>

<style>
  .session-card { border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--surface); overflow: hidden; box-shadow: var(--shadow-sm); }
  header { display: flex; align-items: center; padding: 0 10px; background: linear-gradient(90deg, var(--surface-2), var(--surface)); }
  .session-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex: 1; min-height: 46px; border: 0; background: transparent; color: var(--text-color); padding: 0; text-align: left; cursor: pointer; }
  .session-title span { font-size: var(--text-md); font-weight: 700; }
  small { color: var(--text-muted); }
  .activities p { padding: 12px 14px; color: var(--text-muted); }
  footer { padding: 8px 10px; border-top: 1px solid var(--border-subtle); }
  footer button { display: flex; align-items: center; gap: 6px; min-height: 30px; border: 0; background: transparent; color: var(--accent); cursor: pointer; }
</style>
