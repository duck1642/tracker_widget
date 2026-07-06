<script>
  // @ts-nocheck
  import { X } from "@lucide/svelte";
  import ReadonlyBadges from "$lib/shared/components/ReadonlyBadges.svelte";

  let { entry, onClose } = $props();
  const activities = $derived(entry?.activities || []);
</script>

<svelte:window onkeydown={(event) => { if (event.key === "Escape") onClose(); }} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-backdrop" role="presentation" onclick={onClose}>
  <div
    class="actual-modal"
    role="dialog"
    aria-modal="true"
    aria-label={`Actual activities for ${entry.session}`}
    tabindex="-1"
    onclick={(event) => event.stopPropagation()}
  >
    <header>
      <div>
        <h2 title={entry.session}>{entry.session || "Unnamed session"}</h2>
        <p>{entry.day} / {entry.actualMinutes}m / {activities.length} activities</p>
      </div>
      <button type="button" class="icon-button" onclick={onClose} aria-label="Close actual activities" title="Close">
        <X size={16} />
      </button>
    </header>

    <div class="activity-list">
      {#each activities as activity}
        <article class="actual-activity">
          <div class="description" title={activity.description || "Activity"}>
            {activity.description || "Activity"}
          </div>
          <ReadonlyBadges subjects={activity.subjects} minutes={activity.minutes} />
        </article>
      {/each}

      {#if activities.length === 0}
        <p class="empty">No activity details available.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.42);
  }

  .actual-modal {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: min(680px, 100%);
    max-height: min(720px, calc(100vh - 48px));
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--surface-2);
  }

  h2 {
    max-width: 560px;
    margin: 0;
    overflow: hidden;
    color: var(--text-color);
    font-size: var(--text-lg);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    margin: 4px 0 0;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .icon-button {
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .icon-button:hover {
    background: var(--surface-hover);
    color: var(--text-color);
  }

  .activity-list {
    overflow: auto;
    min-height: 0;
  }

  .actual-activity {
    display: grid;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .description {
    min-width: 0;
    overflow: hidden;
    color: var(--text-color);
    font-size: var(--text-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    padding: 22px 16px;
    color: var(--text-muted);
  }
</style>
