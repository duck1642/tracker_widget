<script>
  // @ts-nocheck
  import ObjectivesSection from "./ObjectivesSection.svelte";
  import PlanSection from "./PlanSection.svelte";
  import ActualSection from "./ActualSection.svelte";
  import NotesEditor from "$lib/shared/components/NotesEditor.svelte";
  import ConflictBanner from "$lib/shared/components/ConflictBanner.svelte";
  import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
  import { sessionHistoryStore } from "$lib/app/sessionHistoryStore.svelte.js";
  import { buildSessionSuggestions } from "$lib/shared/services/sessionSuggestions.js";

  let historicalSessionSuggestions = $derived(buildSessionSuggestions({ historicalSessions: sessionHistoryStore.suggestions }));
  let collapsedDays = $state([]);

  function toggleDay(day) {
    if (collapsedDays.includes(day)) {
      collapsedDays = collapsedDays.filter((item) => item !== day);
    } else if (collapsedDays.length < 6) {
      collapsedDays = [...collapsedDays, day];
    }
  }

  function scrollToSection(event, id) {
    event.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

</script>

<main class="week-panel">
  {#if !weekStore.loaded}
    <div class="empty"><strong>No weekly index selected</strong><span>Choose a week from the file tree.</span></div>
  {:else}
    <header class="week-hero">
      <div>
        <h1>{weekStore.descriptor.year} - Week {weekStore.descriptor.week}</h1>
        <p>{weekStore.descriptor.rangeLabel}</p>
      </div>
      <nav aria-label="Week sections">
        <a href="#objectives" onclick={(e) => scrollToSection(e, "objectives")}>Objectives</a>
        <a href="#plan" onclick={(e) => scrollToSection(e, "plan")}>Plan</a>
        <a href="#actual" onclick={(e) => scrollToSection(e, "actual")}>Actual</a>
        <a href="#week-notes" onclick={(e) => scrollToSection(e, "week-notes")}>Notes</a>
      </nav>
    </header>
    {#if weekStore.conflict}<ConflictBanner onReloadExternal={() => weekStore.resolveConflict("reload")} onKeepLocal={() => weekStore.resolveConflict("keep-local")} />{/if}
    <ObjectivesSection objectives={weekStore.objectives} foldedObjectiveIds={weekStore.foldedObjectiveIds} onFoldChange={(ids) => weekStore.setObjectiveFolds(ids)} onAdd={() => weekStore.addObjective()} onUpdate={(id, patch) => weekStore.updateObjective(id, patch)} onDelete={(id) => weekStore.removeObjective(id)} onMove={(id, direction) => weekStore.moveObjective(id, direction)} onIndent={(id) => weekStore.indentObjective(id)} onOutdent={(id) => weekStore.outdentObjective(id)} />
    <PlanSection
      plan={weekStore.plan}
      suggestions={historicalSessionSuggestions}
      {collapsedDays}
      {toggleDay}
      onAdd={(day) => weekStore.addPlanEntry(day)}
      onUpdate={(id, patch) => weekStore.updatePlanEntry(id, patch)}
      onDelete={(id) => weekStore.removePlanEntry(id)}
      onDuplicate={(id) => weekStore.duplicatePlanEntry(id)}
      onMove={(sourceId, targetId, position) => weekStore.movePlanEntry(sourceId, targetId, position)}
      onMoveToDay={(sourceId, day) => weekStore.movePlanEntryToDay(sourceId, day)}
      onAddActivity={(entryId) => weekStore.addPlanActivity(entryId)}
      onUpdateActivity={(entryId, activityId, patch) => weekStore.updatePlanActivity(entryId, activityId, patch)}
      onDeleteActivity={(entryId, activityId) => weekStore.removePlanActivity(entryId, activityId)}
      onMoveActivity={(entryId, activityId, direction) => weekStore.movePlanActivity(entryId, activityId, direction)}
    />
    <ActualSection actual={weekStore.actual} onRefresh={() => weekStore.refreshActual()} {collapsedDays} {toggleDay} />
    <div id="week-notes" class="week-notes">
      <NotesEditor value={weekStore.notesRaw} onChange={(value) => weekStore.updateNotes(value)} />
    </div>
  {/if}
</main>


<style>
  .week-panel { --panel-bottom-gap: 22px; display: grid; align-content: start; gap: 16px; width: min(100%, 1280px); margin: 0 auto; padding: 0 16px var(--panel-bottom-gap); box-sizing: border-box; }
  .week-hero { position: sticky; top: 0; z-index: var(--layer-sticky-header); display: flex; justify-content: space-between; align-items: end; gap: 20px; padding: 22px 0 14px; background: var(--bg-panel); }
  h1 { margin: 5px 0 2px; font-size: var(--text-xl); } p { margin: 0; color: var(--text-muted); }
  nav { display: flex; gap: 4px; } nav a { padding: 7px 9px; border-radius: 5px; color: var(--text-muted); text-decoration: none; font-size: var(--text-sm); } nav a:hover { background: var(--surface-hover); color: var(--text-color); }
  .week-notes { scroll-margin-top: 100px; }
</style>
