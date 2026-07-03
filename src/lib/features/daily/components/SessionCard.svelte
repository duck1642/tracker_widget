<script>
  // @ts-nocheck
  import { Plus, Trash2 } from "@lucide/svelte";
  import ActivityRow from "./ActivityRow.svelte";
  let { session, onAddActivity, onUpdateActivity, onDeleteActivity, onDeleteSession, onRenameSession } = $props();
  let expanded = $state(true);
  let isEditingName = $state(false);
  let editNameInput = $state("");
  let subtotal = $derived(session.activities.reduce((sum, activity) => sum + activity.minutes, 0));

  function focus(node) {
    node.focus();
  }

  function saveName() {
    isEditingName = false;
    const name = editNameInput.trim();
    if (name && name !== session.name) {
      const ok = onRenameSession(name);
      if (!ok) {
        editNameInput = session.name;
      }
    } else {
      editNameInput = session.name;
    }
  }

  $effect(() => {
    if (!isEditingName) {
      editNameInput = session.name;
    }
  });
</script>

<article class="session-card">
  <header>
    {#if isEditingName}
      <input
        class="name-input"
        value={editNameInput}
        oninput={(event) => editNameInput = event.currentTarget.value}
        onblur={saveName}
        onkeydown={(e) => {
          if (e.key === "Enter") {
            saveName();
          } else if (e.key === "Escape") {
            isEditingName = false;
            editNameInput = session.name;
          }
        }}
        use:focus
        onclick={(e) => e.stopPropagation()}
      />
    {:else}
      <button class="session-title" onclick={() => expanded = !expanded} aria-expanded={expanded}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
          class="session-name-text"
          onclick={(e) => {
            e.stopPropagation();
            isEditingName = true;
            editNameInput = session.name;
          }}
          title={`${session.name} - click to rename`}
        >
          {session.name}
        </span>
        <small>{subtotal}m · {session.activities.length} activities</small>
      </button>
    {/if}
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
  .session-card { border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--surface); overflow: visible; box-shadow: var(--shadow-sm); }
  header { display: flex; align-items: center; padding: 0 10px; background: linear-gradient(90deg, var(--surface-2), var(--surface)); }
  .session-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex: 1; min-width: 0; min-height: 46px; border: 0; background: transparent; color: var(--text-color); padding: 0; text-align: left; cursor: pointer; }
  .session-name-text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; flex: 1; min-width: 0; font-size: var(--text-md); font-weight: 700; line-height: 1.25; cursor: pointer; border-bottom: 1px dashed transparent; transition: border-color 0.15s ease, color 0.15s ease; }
  .session-name-text:hover { border-bottom-color: var(--accent); color: var(--accent); }
  .name-input { flex: 1; font-size: var(--text-md); font-weight: 700; min-height: 46px; background: transparent; border: none; border-bottom: 1px dashed var(--border-strong); color: var(--text-color); outline: none; padding: 0; box-sizing: border-box; }
  .name-input:focus, .name-input:focus-visible { border: none; border-bottom: 1px dashed var(--accent); box-shadow: none; outline: none; }
  small { flex-shrink: 0; color: var(--text-muted); }
  .activities p { padding: 12px 14px; color: var(--text-muted); }
  footer { padding: 8px 10px; border-top: 1px solid var(--border-subtle); }
  footer button { display: flex; align-items: center; gap: 6px; min-height: 30px; border: 0; background: transparent; color: var(--accent); cursor: pointer; }
</style>
