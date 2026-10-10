<script lang="ts">
  import DailyHeader from "./DailyHeader.svelte";
  import SessionCard from "./SessionCard.svelte";
  import AddSessionForm from "./AddSessionForm.svelte";
  import NotesEditor from "$lib/shared/components/NotesEditor.svelte";
  import ContextMenu from "$lib/shared/components/ContextMenu.svelte";
  import { ChevronDown, ChevronUp, Trash2 } from "@lucide/svelte";
  import { appStore } from "$lib/app/appStore.svelte.ts";
  import { captureEditableText } from "$lib/shared/services/editableTextClipboard.ts";
  import { buildEditableTextMenuItems } from "$lib/shared/services/editableTextMenuItems.ts";
  import { dailyStore as defaultDailyStore } from "$lib/features/daily/dailyStore.svelte.ts";
  import { weekStore as defaultWeekStore } from "$lib/features/weekly/weekStore.svelte.ts";
  import { sessionHistoryStore } from "$lib/app/sessionHistoryStore.svelte.ts";
  import { buildSessionSuggestions } from "$lib/shared/services/sessionSuggestions.ts";
  import { dayLabel } from "$lib/shared/services/logWorkspaceService.ts";
  import type { DailyStore } from "../dailyStore.svelte.ts";
  import type { DragEvent, DragOverEvent, DropEvent, DropPosition } from "$lib/shared/actions/sortableDrag.ts";
  import type { MenuPosition } from "$lib/shared/components/types.ts";
  import type { EditableTextContext } from "$lib/shared/services/editableTextClipboard.ts";
  type DayMenu = MenuPosition & ({ kind: "session"; sessionId: string } | {
      kind: "activity";
      sessionId: string;
      activityId: string;
  });
  let { dailyStore = defaultDailyStore, weekStore = defaultWeekStore }: { dailyStore?: DailyStore; weekStore?: Pick<typeof defaultWeekStore, "currentWeekSessionNames"> } = $props();
  let day = $derived(dailyStore.date ? dayLabel(new Date(`${dailyStore.date}T12:00:00`)) : "");
  let suggestions = $derived(buildSessionSuggestions({
    currentWeekSessions: weekStore.currentWeekSessionNames(),
    historicalSessions: sessionHistoryStore.suggestions
  }));
  let existingSessions = $derived(dailyStore.sessions.map((session) => session.name));
  let draggedSessionId = $state<string | null>(null);
  let dragOverSessionId = $state<string | null>(null);
  let dropPosition = $state<DropPosition>("before");
  let contextMenu = $state<DayMenu | null>(null);
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

  function editableMenuItems(editable: EditableTextContext | null | undefined) {
    return buildEditableTextMenuItems(editable, {
      beforeAction: closeContextMenu,
      onError: (error) => appStore.showStatus(`Clipboard failed: ${error}`)
    });
  }

  function openSessionContextMenu(event: MouseEvent, sessionId: string) {
    event.preventDefault();
    contextMenu = { kind: "session", sessionId, x: event.clientX, y: event.clientY, editable: captureEditableText(event.target) };
  }

  function openActivityContextMenu(event: MouseEvent, sessionId: string, activityId: string) {
    event.preventDefault();
    contextMenu = { kind: "activity", sessionId, activityId, x: event.clientX, y: event.clientY, editable: captureEditableText(event.target) };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function runEntityAction<Args extends unknown[]>(action: (...args: Args) => unknown, ...args: Args) {
    closeContextMenu();
    action(...args);
  }

  function moveSession(sessionId: string, direction: "up" | "down") {
    const index = dailyStore.sessions.findIndex((session) => session.id === sessionId);
    const target = dailyStore.sessions[index + (direction === "up" ? -1 : 1)];
    if (target) dailyStore.moveSessionTo(sessionId, target.id, direction === "up" ? "before" : "after");
  }

  function clearSessionDrag() {
    draggedSessionId = null;
    dragOverSessionId = null;
    dropPosition = "before";
  }

  function sessionDragState(sessionId: string) {
    return {
      dragging: draggedSessionId === sessionId,
      over: dragOverSessionId === sessionId && draggedSessionId !== sessionId,
      position: dropPosition
    };
  }

  function handleSessionDragStart({ id }: DragEvent) {
    draggedSessionId = id;
  }

  function handleSessionDragOver({ id, position }: DragOverEvent) {
    if (!draggedSessionId || draggedSessionId === id) return;
    dragOverSessionId = id;
    dropPosition = position;
  }

  function handleSessionDragLeave({ id }: DragEvent) {
    if (dragOverSessionId === id) {
      dragOverSessionId = null;
      dropPosition = "before";
    }
  }

  function handleSessionDrop({ sourceId, targetId, position }: DropEvent) {
    dailyStore.moveSessionTo(sourceId, targetId, position);
    clearSessionDrag();
  }
</script>

<main class="daily-panel">
  {#if !dailyStore.loaded}
    <div class="empty"><strong>No daily log selected</strong><span>Choose a day from the file tree or open Day.</span></div>
  {:else}
    <DailyHeader date={dailyStore.date} totalMinutes={dailyStore.totalMinutes} unknownDurationCount={dailyStore.unknownDurationCount} />
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
    <NotesEditor value={dailyStore.notesRaw} onChange={(value: string) => dailyStore.updateNotes(value)} />
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
