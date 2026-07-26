<script>
  // @ts-nocheck
  import { ChevronDown, ChevronUp, IndentDecrease, IndentIncrease, Plus, Trash2 } from "@lucide/svelte";
  import { appStore } from "$lib/app/appStore.svelte.js";
  import ContextMenu from "$lib/shared/components/ContextMenu.svelte";
  import { captureEditableText } from "$lib/shared/services/editableTextClipboard.js";
  import { buildEditableTextMenuItems } from "$lib/shared/services/editableTextMenuItems.js";
  import ObjectiveRow from "./ObjectiveRow.svelte";
  import { buildVisibleObjectiveRows } from "../objectiveFolding.js";
  let {
    objectives,
    foldedObjectiveIds = [],
    onFoldChange = () => {},
    onAdd,
    onUpdate,
    onDelete,
    onMove,
    onIndent,
    onOutdent
  } = $props();

  let contextMenu = $state(null);
  let visibleObjectives = $derived(buildVisibleObjectiveRows(objectives, foldedObjectiveIds));
  let contextObjective = $derived(contextMenu ? objectives.find((objective) => objective.id === contextMenu.id) : null);
  let contextObjectiveIndex = $derived(contextObjective ? objectives.findIndex((objective) => objective.id === contextObjective.id) : -1);
  let contextMenuItems = $derived.by(() => {
    if (!contextObjective) return [];
    const editable = contextMenu?.editable;
    return [
      ...buildEditableTextMenuItems(editable, {
        beforeAction: closeContextMenu,
        onError: (error) => appStore.showStatus(`Clipboard failed: ${error}`)
      }),
      { label: "Indent", icon: IndentIncrease, disabled: (contextObjective.indent || 0) >= 2, onclick: () => runContextAction(onIndent, contextObjective.id) },
      { label: "Outdent", icon: IndentDecrease, disabled: (contextObjective.indent || 0) <= 0, onclick: () => runContextAction(onOutdent, contextObjective.id) },
      { label: "Move Up", icon: ChevronUp, disabled: contextObjectiveIndex <= 0, onclick: () => runContextAction(onMove, contextObjective.id, "up") },
      { label: "Move Down", icon: ChevronDown, disabled: contextObjectiveIndex >= objectives.length - 1, onclick: () => runContextAction(onMove, contextObjective.id, "down") },
      { separator: true },
      { label: "Delete", icon: Trash2, danger: true, onclick: () => runContextAction(onDelete, contextObjective.id) }
    ];
  });

  function toggleFold(id) {
    const next = foldedObjectiveIds.includes(id)
      ? foldedObjectiveIds.filter((item) => item !== id)
      : [...foldedObjectiveIds, id];
    return onFoldChange(next);
  }

  function openContextMenu(event, id) {
    event.preventDefault();
    contextMenu = { x: event.clientX, y: event.clientY, id, editable: captureEditableText(event.target) };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function runContextAction(action, ...args) {
    closeContextMenu();
    action(...args);
  }

</script>

<section id="objectives" class="week-section">
  <header><div><h2>Objectives</h2></div></header>
  <div class="objectives-list">
    {#each visibleObjectives.rows as row (row.objective.id)}
      <ObjectiveRow
        objective={row.objective}
        hasChildren={row.hasChildren}
        isFolded={row.isFolded}
        canMoveUp={row.index > 0}
        canMoveDown={row.index < objectives.length - 1}
        onToggleFold={() => toggleFold(row.objective.id)}
        onUpdate={(patch) => onUpdate(row.objective.id, patch)}
        onDelete={() => onDelete(row.objective.id)}
        onMoveUp={() => onMove(row.objective.id, "up")}
        onMoveDown={() => onMove(row.objective.id, "down")}
        onIndent={() => onIndent(row.objective.id)}
        onOutdent={() => onOutdent(row.objective.id)}
        onOpenContextMenu={(event) => openContextMenu(event, row.objective.id)}
      />
    {/each}
    {#if objectives.length === 0}
      <p class="empty-copy">No objectives yet.</p>
    {/if}
    <div class="actions-footer">
      <button type="button" class="add-activity-btn" onclick={onAdd} title="Add objective">
        <Plus size={14} /> Add objective
      </button>
    </div>
  </div>
  {#if contextMenu && contextObjective}
    <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} ariaLabel="Objective actions" preserveFocus={Boolean(contextMenu.editable)} onDismiss={closeContextMenu} />
  {/if}
</section>

<style>
  .objectives-list { display: flex; flex-direction: column; }
  .objectives-list > :global(.objective-card:last-of-type) { padding-bottom: 18px; }
  .actions-footer { display: flex; justify-content: flex-start; margin: 0 -16px; padding: 10px 16px 2px; border-top: 1px solid var(--border-subtle); }
  .add-activity-btn { display: flex; align-items: center; gap: 6px; min-height: 30px; border: 0; background: transparent; color: var(--accent); cursor: pointer; font-size: var(--text-sm); font-weight: 500; padding: 0; transition: color 0.15s ease; }
  .add-activity-btn:hover { color: var(--text-color); }
</style>
