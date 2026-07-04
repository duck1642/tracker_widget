<script>
  // @ts-nocheck
  import { GripVertical, Plus, Trash2 } from "@lucide/svelte";
  import { sortableDragHandle, sortableDropTarget } from "$lib/shared/actions/sortableDrag.js";
  import ActivityRow from "./ActivityRow.svelte";
  let {
    session,
    dragState = null,
    onAddActivity,
    onUpdateActivity,
    onDeleteActivity,
    onMoveActivity,
    onDeleteSession,
    onRenameSession,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd
  } = $props();
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

<article
  class="session-card"
  class:dragging={dragState?.dragging}
  class:drop-before={dragState?.over && dragState?.position === "before"}
  class:drop-after={dragState?.over && dragState?.position === "after"}
  use:sortableDropTarget={{
    id: session.id,
    type: "daily-session",
    onOver: onDragOver,
    onLeave: onDragLeave,
    onDrop
  }}
>
  <header>
    <span
      role="button"
      tabindex="0"
      class="drag-handle"
      aria-label={`Reorder ${session.name}`}
      title="Drag to reorder"
      use:sortableDragHandle={{
        id: session.id,
        type: "daily-session",
        onStart: onDragStart,
        onEnd: onDragEnd
      }}
    >
      <GripVertical size={15} />
    </span>
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
          title={session.name}
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
      {#each session.activities as activity, index (activity.id)}
        <ActivityRow
          {activity}
          canMoveUp={index > 0}
          canMoveDown={index < session.activities.length - 1}
          onUpdate={(patch) => onUpdateActivity(activity.id, patch)}
          onDelete={() => onDeleteActivity(activity.id)}
          onMoveUp={() => onMoveActivity(activity.id, "up")}
          onMoveDown={() => onMoveActivity(activity.id, "down")}
        />
      {/each}
      {#if session.activities.length === 0}<p>No activities yet.</p>{/if}
    </div>
    <footer><button onclick={onAddActivity}><Plus size={14} /> Add activity</button></footer>
  {/if}
</article>

<style>
  .session-card { border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--surface); overflow: visible; box-shadow: var(--shadow-sm); }
  .session-card.dragging { opacity: 0.58; }
  .session-card.drop-before { box-shadow: 0 -2px 0 var(--accent), var(--shadow-sm); }
  .session-card.drop-after { box-shadow: 0 2px 0 var(--accent), var(--shadow-sm); }
  header { display: flex; align-items: center; padding: 0 10px; border-radius: var(--radius-lg) var(--radius-lg) 0 0; background: var(--surface-2); }
  .drag-handle { display: inline-grid; place-items: center; flex: 0 0 24px; width: 24px; height: 28px; margin-right: 6px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); cursor: grab; user-select: none; }
  .drag-handle:hover { background: var(--surface-hover); color: var(--text-color); }
  .drag-handle:active { cursor: grabbing; }
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
