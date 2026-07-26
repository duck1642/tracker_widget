<script>
  // @ts-nocheck
  import DailyHeader from "./DailyHeader.svelte";
  import SessionCard from "./SessionCard.svelte";
  import AddSessionForm from "./AddSessionForm.svelte";
  import NotesEditor from "$lib/shared/components/NotesEditor.svelte";
  import ConflictBanner from "$lib/shared/components/ConflictBanner.svelte";
  import ContextMenu from "$lib/shared/components/ContextMenu.svelte";
  import { ChevronDown, ChevronUp, Trash2 } from "@lucide/svelte";
  import { appStore } from "$lib/app/appStore.svelte.js";
  import { captureEditableText } from "$lib/shared/services/editableTextClipboard.js";
  import { buildEditableTextMenuItems } from "$lib/shared/services/editableTextMenuItems.js";
  import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
  import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
  import { sessionHistoryStore } from "$lib/app/sessionHistoryStore.svelte.js";
  import { buildSessionSuggestions } from "$lib/shared/services/sessionSuggestions.js";
  import { dayLabel } from "$lib/shared/services/logWorkspaceService.js";
  let day = $derived(dailyStore.date ? dayLabel(new Date(`${dailyStore.date}T12:00:00`)) : "");
  let suggestions = $derived(buildSessionSuggestions({
    currentWeekSessions: weekStore.currentWeekSessionNames(),
    historicalSessions: sessionHistoryStore.suggestions
  }));
  let existingSessions = $derived(dailyStore.sessions.map((session) => session.name));
  let draggedSessionId = $state(null);
  let dragOverSessionId = $state(null);
  let dropPosition = $state("before");
  let contextMenu = $state(null);
  let contextMenuItems = $derived.by(() => {
    if (!contextMenu) return [];
    const items = editableMenuItems(contextMenu.editable);

    if (contextMenu.kind === "session") {
      const sessionId = contextMenu.sessionId;
      const index = dailyStore.sessions.findIndex((session) => session.id === sessionId);
      items.push(
        { label: "Move Up", icon: ChevronUp, disabled: index <= 0, onclick: () => runEntityAction(moveSession, sessionId, "up") },
        { label: "Move Down", icon: ChevronDown, disabled: index < 0 || index >= dailyStore.sessions.length - 1, onclick: () => runEntityAction(moveSession, sessionId, "down") },
        { separator: true },
        { label: "Delete", icon: Trash2, danger: true, onclick: () => runEntityAction((id) => dailyStore.removeSession(id), sessionId) }
      );
    } else {
      const sessionId = contextMenu.sessionId;
      const activityId = contextMenu.activityId;
      const session = dailyStore.sessions.find((item) => item.id === sessionId);
      const index = session?.activities.findIndex((activity) => activity.id === activityId) ?? -1;
      items.push(
        { label: "Move Up", icon: ChevronUp, disabled: index <= 0, onclick: () => runEntityAction((sid, aid) => dailyStore.moveActivity(sid, aid, "up"), sessionId, activityId) },
        { label: "Move Down", icon: ChevronDown, disabled: index < 0 || index >= (session?.activities.length ?? 0) - 1, onclick: () => runEntityAction((sid, aid) => dailyStore.moveActivity(sid, aid, "down"), sessionId, activityId) },
        { separator: true },
        { label: "Delete", icon: Trash2, danger: true, onclick: () => runEntityAction((sid, aid) => dailyStore.removeActivity(sid, aid), sessionId, activityId) }
      );
    }
    return items;
  });

  function editableMenuItems(editable) {
    return buildEditableTextMenuItems(editable, {
      beforeAction: closeContextMenu,
      onError: (error) => appStore.showStatus(`Clipboard failed: ${error}`)
    });
  }

  function openSessionContextMenu(event, sessionId) {
    event.preventDefault();
    contextMenu = { kind: "session", sessionId, x: event.clientX, y: event.clientY, editable: captureEditableText(event.target) };
  }

  function openActivityContextMenu(event, sessionId, activityId) {
    event.preventDefault();
    contextMenu = { kind: "activity", sessionId, activityId, x: event.clientX, y: event.clientY, editable: captureEditableText(event.target) };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function runEntityAction(action, ...args) {
    closeContextMenu();
    action(...args);
  }

  function moveSession(sessionId, direction) {
    const index = dailyStore.sessions.findIndex((session) => session.id === sessionId);
    const target = dailyStore.sessions[index + (direction === "up" ? -1 : 1)];
    if (target) dailyStore.moveSessionTo(sessionId, target.id, direction === "up" ? "before" : "after");
  }

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
    <DailyHeader date={dailyStore.date} totalMinutes={dailyStore.totalMinutes} unknownDurationCount={dailyStore.unknownDurationCount} />
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
          onOpenSessionContextMenu={(event) => openSessionContextMenu(event, session.id)}
          onOpenActivityContextMenu={(event, activityId) => openActivityContextMenu(event, session.id, activityId)}
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
    {#if contextMenu}
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenuItems}
        ariaLabel={contextMenu.kind === "session" ? "Session actions" : "Activity actions"}
        preserveFocus={Boolean(contextMenu.editable)}
        onDismiss={closeContextMenu}
      />
    {/if}
  {/if}
</main>

<style>
  .daily-panel { --panel-bottom-gap: 22px; display: grid; align-content: start; gap: 18px; width: 100%; margin: 0 auto; padding: 0 16px var(--panel-bottom-gap); box-sizing: border-box; }
  .sessions { display: grid; gap: 12px; }
</style>
