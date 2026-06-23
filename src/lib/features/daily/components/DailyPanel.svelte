<script>
  // @ts-nocheck
  import DailyHeader from "./DailyHeader.svelte";
  import SessionCard from "./SessionCard.svelte";
  import AddSessionForm from "./AddSessionForm.svelte";
  import NotesEditor from "$lib/shared/components/NotesEditor.svelte";
  import ConflictBanner from "$lib/shared/components/ConflictBanner.svelte";
  import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
  import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
  import { dayLabel } from "$lib/shared/services/logWorkspaceService.js";
  let day = $derived(dailyStore.date ? dayLabel(new Date(`${dailyStore.date}T12:00:00`)) : "");
  let suggestions = $derived(weekStore.suggestionsFor(day));
</script>

<main class="daily-panel">
  {#if !dailyStore.loaded}
    <div class="empty"><strong>No daily log selected</strong><span>Choose a day from the file tree or open Day.</span></div>
  {:else}
    <DailyHeader date={dailyStore.date} totalMinutes={dailyStore.totalMinutes} saving={dailyStore.saving} />
    {#if dailyStore.conflict}<ConflictBanner onReloadExternal={() => dailyStore.resolveConflict("reload")} onKeepLocal={() => dailyStore.resolveConflict("keep-local")} />{/if}
    <section class="sessions">
      {#each dailyStore.sessions as session (session.id)}
        <SessionCard {session} onAddActivity={() => dailyStore.addActivity(session.id)} onUpdateActivity={(activityId, patch) => dailyStore.updateActivity(session.id, activityId, patch)} onDeleteActivity={(activityId) => dailyStore.removeActivity(session.id, activityId)} onDeleteSession={() => dailyStore.removeSession(session.id)} onRenameSession={(name) => dailyStore.renameSession(session.id, name)} />
      {/each}
      <AddSessionForm {suggestions} onAdd={(name) => dailyStore.addSession(name)} />
    </section>
    <NotesEditor value={dailyStore.notesRaw} onChange={(value) => dailyStore.updateNotes(value)} />
  {/if}
</main>

<style>
  .daily-panel { display: grid; align-content: start; gap: 18px; width: min(100%, 1040px); margin: 0 auto; padding: 0 22px 22px 22px; box-sizing: border-box; }
  .sessions { display: grid; gap: 12px; }
</style>
