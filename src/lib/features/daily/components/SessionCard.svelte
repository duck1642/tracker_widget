<script>
  // @ts-nocheck
  import { GripVertical, Plus, Trash2 } from "@lucide/svelte";
  import { sortableDragHandle, sortableDropTarget } from "$lib/shared/actions/sortableDrag.js";
  import ActivityRow from "./ActivityRow.svelte";
  let {
    session,
    dragState = null,
    suggestions = [],
    existingSessions = [],
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
  let nameEdited = $state(false);
  let showSuggestions = $state(false);
  let highlightedIndex = $state(-1);
  let subtotal = $derived(session.activities.reduce((sum, activity) => sum + activity.minutes, 0));

  const normalize = (value) => value.trim().toLowerCase();
  let filteredSuggestions = $derived(
    suggestions.filter((suggestion) => {
      const trimmed = suggestion.trim();
      const query = nameEdited ? editNameInput.trim().toLowerCase() : "";
      const matches = trimmed.toLowerCase().includes(query);
      const isCurrent = normalize(trimmed) === normalize(session.name);
      const alreadyExists = existingSessions.some((name) => normalize(name) === normalize(trimmed) && normalize(name) !== normalize(session.name));
      return trimmed && matches && (isCurrent || !alreadyExists);
    })
  );

  function focus(node) {
    node.focus();
  }

  function saveName(value = editNameInput) {
    isEditingName = false;
    nameEdited = false;
    showSuggestions = false;
    highlightedIndex = -1;
    const name = value.trim();
    if (name && name !== session.name) {
      const ok = onRenameSession(name);
      if (!ok) {
        editNameInput = session.name;
      }
    } else {
      editNameInput = session.name;
    }
  }

  function beginEditName() {
    isEditingName = true;
    editNameInput = session.name;
    nameEdited = false;
    showSuggestions = suggestions.length > 0;
    highlightedIndex = -1;
  }

  function cancelNameEdit() {
    isEditingName = false;
    editNameInput = session.name;
    nameEdited = false;
    showSuggestions = false;
    highlightedIndex = -1;
  }

  function selectSuggestion(suggestion) {
    editNameInput = suggestion;
    saveName(suggestion);
  }

  function handleNameKeyDown(event) {
    if (event.key === "Enter") {
      if (showSuggestions && highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        event.preventDefault();
        selectSuggestion(filteredSuggestions[highlightedIndex]);
      } else {
        saveName();
      }
    } else if (event.key === "Escape") {
      cancelNameEdit();
    } else if (event.key === "ArrowDown") {
      if (filteredSuggestions.length > 0) {
        event.preventDefault();
        showSuggestions = true;
        highlightedIndex = (highlightedIndex + 1) % filteredSuggestions.length;
      }
    } else if (event.key === "ArrowUp") {
      if (showSuggestions && filteredSuggestions.length > 0) {
        event.preventDefault();
        highlightedIndex = (highlightedIndex - 1 + filteredSuggestions.length) % filteredSuggestions.length;
      }
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
      <div class="name-edit-wrapper">
        <input
          class="name-input"
          value={editNameInput}
          oninput={(event) => {
            editNameInput = event.currentTarget.value;
            nameEdited = true;
            showSuggestions = true;
          }}
          onfocus={() => showSuggestions = true}
          onblur={() => setTimeout(() => saveName(), 150)}
          onkeydown={handleNameKeyDown}
          use:focus
          onclick={(e) => e.stopPropagation()}
          autocomplete="off"
          spellcheck="false"
        />
        {#if showSuggestions && filteredSuggestions.length > 0}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <ul class="suggestions-dropdown" onmousedown={(e) => e.preventDefault()}>
            {#each filteredSuggestions as suggestion, index}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
              <li
                class="suggestion-item"
                class:highlighted={index === highlightedIndex}
                onmouseenter={() => highlightedIndex = index}
                onclick={() => selectSuggestion(suggestion)}
                role="option"
                aria-selected={index === highlightedIndex}
                title={suggestion}
              >
                {suggestion}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {:else}
      <button class="session-title" onclick={() => expanded = !expanded} aria-expanded={expanded}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
          class="session-name-text"
          onclick={(e) => {
            e.stopPropagation();
            beginEditName();
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
  .name-edit-wrapper { position: relative; flex: 1; min-width: 0; display: flex; }
  .name-input { flex: 1; width: 100%; font-size: var(--text-md); font-weight: 700; min-height: 46px; background: transparent; border: none; border-bottom: 1px dashed var(--border-strong); color: var(--text-color); outline: none; padding: 0; box-sizing: border-box; }
  .name-input:focus, .name-input:focus-visible { border: none; border-bottom: 1px dashed var(--accent); box-shadow: none; outline: none; }
  .suggestions-dropdown { position: absolute; top: calc(100% + 4px); left: 0; z-index: 60; width: min(260px, 100%); max-height: 156px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; margin: 0; padding: 4px 0; list-style: none; background: #181818; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); box-sizing: border-box; }
  .suggestions-dropdown::-webkit-scrollbar { width: 6px; }
  .suggestions-dropdown::-webkit-scrollbar-thumb { border-radius: 999px; background: var(--border-strong); }
  .suggestions-dropdown::-webkit-scrollbar-track { background: transparent; }
  .suggestion-item { padding: 8px 12px; font-size: var(--text-sm); color: var(--text-muted); cursor: pointer; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: background 0.1s ease, color 0.1s ease; }
  .suggestion-item:hover, .suggestion-item.highlighted { background: var(--surface-hover); color: var(--text-color); }
  small { flex-shrink: 0; color: var(--text-muted); }
  .activities p { padding: 12px 14px; color: var(--text-muted); }
  footer { padding: 8px 10px; border-top: 1px solid var(--border-subtle); }
  footer button { display: flex; align-items: center; gap: 6px; min-height: 30px; border: 0; background: transparent; color: var(--accent); cursor: pointer; }
</style>
