<script>
  // @ts-nocheck
  import { Trash2 } from "@lucide/svelte";
  import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
  import TimeInput from "$lib/shared/components/TimeInput.svelte";
  let { activity, onUpdate, onDelete } = $props();
</script>

<div class="activity-row">
  <SubjectInput subjects={activity.subjects} onChange={(subjects) => onUpdate({ subjects })} />
  <TimeInput minutes={activity.minutes} onChange={(minutes) => onUpdate({ minutes })} />
  <label class="description"><span>Description</span><input value={activity.description} oninput={(event) => onUpdate({ description: event.currentTarget.value.replace(/[\r\n]/g, " ") })} placeholder="What happened?" /></label>
  <button class="delete" onclick={onDelete} aria-label="Delete activity"><Trash2 size={15} /></button>
</div>

<style>
  .activity-row { display: grid; grid-template-columns: minmax(150px, .8fr) 86px minmax(220px, 1.4fr) 32px; align-items: end; gap: 9px; padding: 10px; border-top: 1px solid var(--border-subtle); }
  .description { display: grid; gap: 4px; min-width: 0; }
  span { color: var(--text-muted); font-size: var(--text-xs); }
  input { width: 100%; box-sizing: border-box; }
  .delete { height: 34px; border: 0; background: transparent; color: var(--text-muted); cursor: pointer; }
  .delete:hover { color: var(--danger); }
  @media (max-width: 760px) { .activity-row { grid-template-columns: 1fr 86px 32px; } .description { grid-column: 1 / -1; grid-row: 2; } }
</style>
