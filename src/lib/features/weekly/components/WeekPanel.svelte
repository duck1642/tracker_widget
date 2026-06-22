<script>
  // @ts-nocheck
  import ObjectivesSection from "./ObjectivesSection.svelte";
  import PlanSection from "./PlanSection.svelte";
  import ActualSection from "./ActualSection.svelte";
  import NotesEditor from "$lib/shared/components/NotesEditor.svelte";
  import ConflictBanner from "$lib/shared/components/ConflictBanner.svelte";
  import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";

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
        <span class="eyebrow">Planning ledger</span>
        <h1>{weekStore.descriptor.year} · Week {weekStore.descriptor.week}</h1>
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
    <ObjectivesSection objectives={weekStore.objectives} onAdd={() => weekStore.addObjective()} onUpdate={(id, patch) => weekStore.updateObjective(id, patch)} onDelete={(id) => weekStore.removeObjective(id)} />
    <PlanSection plan={weekStore.plan} onAdd={(day) => weekStore.addPlanEntry(day)} onUpdate={(id, patch) => weekStore.updatePlanEntry(id, patch)} onDelete={(id) => weekStore.removePlanEntry(id)} />
    <ActualSection actual={weekStore.actual} onRefresh={() => weekStore.refreshActual()} />
    <section id="week-notes" class="week-section"><header><div><span class="section-index">04</span><h2>Notes</h2></div></header><NotesEditor value={weekStore.notesRaw} onChange={(value) => weekStore.updateNotes(value)} label="Weekly notes" /></section>
  {/if}
</main>


<style>
  .week-panel { display: grid; align-content: start; gap: 16px; width: min(100%, 1120px); margin: 0 auto; padding: 22px; box-sizing: border-box; }
  .week-hero { position: sticky; top: -22px; z-index: 5; display: flex; justify-content: space-between; align-items: end; gap: 20px; padding: 18px 0 14px; background: linear-gradient(var(--bg-panel) 80%, transparent); }
  .eyebrow { color: var(--accent); font-size: var(--text-xs); font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  h1 { margin: 5px 0 2px; font-size: var(--text-xl); } p { margin: 0; color: var(--text-muted); }
  nav { display: flex; gap: 4px; } nav a { padding: 7px 9px; border-radius: 5px; color: var(--text-muted); text-decoration: none; font-size: var(--text-sm); } nav a:hover { background: var(--surface-hover); color: var(--text-color); }
</style>
