<script>
  // @ts-nocheck
  import DailyHeader from "./DailyHeader.svelte";
  import SessionCard from "./SessionCard.svelte";
  import AddSessionForm from "./AddSessionForm.svelte";
  import NotesEditor from "$lib/shared/components/NotesEditor.svelte";
  import ConflictBanner from "$lib/shared/components/ConflictBanner.svelte";
  import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
  import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
  import { sessionHistoryStore } from "$lib/app/sessionHistoryStore.svelte.js";
  import { buildSessionSuggestions } from "$lib/shared/services/sessionSuggestions.js";
  import { dayLabel } from "$lib/shared/services/logWorkspaceService.js";
  let day = $derived(dailyStore.date ? dayLabel(new Date(`${dailyStore.date}T12:00:00`)) : "");
  let suggestions = $derived(buildSessionSuggestions({
    currentWeekSessions: weekStore.currentWeekSessionNames(),
    historicalSessions: sessionHistoryStore.suggestions
  }).map((suggestion) => suggestion.name));
  let existingSessions = $derived(dailyStore.sessions.map((session) => session.name));
  let draggedSessionId = $state(null);
  let dragOverSessionId = $state(null);
  let dropPosition = $state("before");

  function clearSessionDrag() {
    draggedSessionId = null;
    dragOverSessionId = null;
    dropPosition = "before";
  }

  function sessionDragState(sessionId) {
    return {
      dragging: draggedSessionId === sessionId,
      over: dragOverSessionId === sessionId && draggedSessionId !== sessionId,
      position: dropPosition
    };
  }

  function handleSessionDragStart({ id }) {
    draggedSessionId = id;
  }

  function handleSessionDragOver({ id, position }) {
    if (!draggedSessionId || draggedSessionId === id) return;
    dragOverSessionId = id;
    dropPosition = position;
  }

  function handleSessionDragLeave({ id }) {
    if (dragOverSessionId === id) {
      dragOverSessionId = null;
      dropPosition = "before";
    }
  }

  function handleSessionDrop({ sourceId, targetId, position }) {
    dailyStore.moveSessionTo(sourceId, targetId, position);
    clearSessionDrag();
  }
</script>

<main class="daily-panel">
  {#if !dailyStore.loaded}
    <div class="empty"><strong>No daily log selected</strong><span>Choose a day from the file tree or open Day.</span></div>
  {:else}
    <DailyHeader date={dailyStore.date} totalMinutes={dailyStore.totalMinutes} saving={dailyStore.saving} />
    {#if dailyStore.conflict}<ConflictBanner onReloadExternal={() => dailyStore.resolveConflict("reload")} onKeepLocal={() => dailyStore.resolveConflict("keep-local")} />{/if}
    <section class="sessions">
      {#each dailyStore.sessions as session (session.id)}
        <SessionCard
          {session}
          dragState={sessionDragState(session.id)}
          {suggestions}
          {existingSessions}
          onAddActivity={() => dailyStore.addActivity(session.id)}
          onUpdateActivity={(activityId, patch) => dailyStore.updateActivity(session.id, activityId, patch)}
          onDeleteActivity={(activityId) => dailyStore.removeActivity(session.id, activityId)}
          onMoveActivity={(activityId, direction) => dailyStore.moveActivity(session.id, activityId, direction)}
          onDeleteSession={() => dailyStore.removeSession(session.id)}
          onRenameSession={(name) => dailyStore.renameSession(session.id, name)}
          onDragStart={handleSessionDragStart}
          onDragOver={handleSessionDragOver}
          onDragLeave={handleSessionDragLeave}
          onDrop={handleSessionDrop}
          onDragEnd={clearSessionDrag}
        />
      {/each}
      <AddSessionForm {suggestions} {existingSessions} onAdd={(name) => dailyStore.addSession(name)} />
    </section>
    <NotesEditor value={dailyStore.notesRaw} onChange={(value) => dailyStore.updateNotes(value)} />
  {/if}
</main>

<style>
  .daily-panel { --panel-bottom-gap: 22px; display: grid; align-content: start; gap: 18px; width: min(100%, 1040px); margin: 0 auto; padding: 0 22px var(--panel-bottom-gap) 22px; box-sizing: border-box; }
  .sessions { display: grid; gap: 12px; }
</style>
