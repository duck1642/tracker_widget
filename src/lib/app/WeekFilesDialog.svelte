<script>
  // @ts-nocheck
  import { X } from "@lucide/svelte";
  import {
    dateForISOWeek,
    getConsecutiveWeekDescriptors,
    getISOWeek
  } from "$lib/shared/services/logWorkspaceService.js";

  let { onClose, onSubmit } = $props();
  const current = getISOWeek(new Date());
  let startWeek = $state(`${current.year}-W${String(current.week).padStart(2, "0")}`);
  let weekCount = $state(1);
  let submitting = $state(false);

  let selection = $derived.by(() => {
    const match = /^(\d{4})-W(\d{2})$/.exec(startWeek);
    if (!match) return null;
    const year = Number(match[1]);
    const week = Number(match[2]);
    const count = Number(weekCount);
    try {
      return {
        year,
        week,
        count,
        descriptors: getConsecutiveWeekDescriptors(dateForISOWeek(year, week), count)
      };
    } catch {
      return null;
    }
  });

  async function submit(event) {
    event.preventDefault();
    if (!selection || submitting) return;
    submitting = true;
    const completed = await onSubmit(selection.year, selection.week, selection.count);
    submitting = false;
    if (completed) onClose();
  }

  function handleKeydown(event) {
    if (event.key === "Escape") onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="backdrop"
  role="presentation"
  onclick={(event) => { if (event.target === event.currentTarget) onClose(); }}
>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="choose-weeks-title">
    <header>
      <div>
        <h2 id="choose-weeks-title">Choose weeks</h2>
        <p>Create missing files without overwriting existing logs.</p>
      </div>
      <button type="button" class="close-btn" onclick={onClose} aria-label="Close"><X size={16} /></button>
    </header>

    <form onsubmit={submit}>
      <div class="fields">
        <label>
          <span>Start week</span>
          <input type="week" aria-label="Start week" bind:value={startWeek} required />
        </label>
        <label>
          <span>Number of weeks</span>
          <input type="number" aria-label="Number of weeks" min="1" max="12" bind:value={weekCount} required />
        </label>
      </div>

      <div class="preview" aria-label="Selected weeks">
        {#if selection}
          {#each selection.descriptors as descriptor}
            <div aria-label={`${descriptor.folderName} · ${descriptor.rangeLabel}`}><strong>{descriptor.folderName}</strong><span>· {descriptor.rangeLabel}</span></div>
          {/each}
        {:else}
          <p>Select a valid ISO week and a range from 1 to 12 weeks.</p>
        {/if}
      </div>

      <footer>
        <button type="button" class="secondary" onclick={onClose}>Cancel</button>
        <button type="submit" class="primary" disabled={!selection || submitting}>
          {submitting
            ? "Working…"
            : `Check/repair ${selection?.count || 0} ${selection?.count === 1 ? "week" : "weeks"}`}
        </button>
      </footer>
    </form>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(0, 0, 0, .62);
  }

  .dialog {
    width: min(440px, 100%);
    max-height: min(620px, calc(100vh - 40px));
    overflow: auto;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: 0 20px 54px rgba(0, 0, 0, .5);
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--border-subtle);
  }

  h2 { margin: 0; font-size: var(--text-lg); }
  p { margin: 4px 0 0; color: var(--text-muted); font-size: var(--text-xs); }

  .close-btn {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .close-btn:hover { background: var(--surface-hover); color: var(--text-color); }
  form { display: grid; gap: 16px; padding: 18px 20px 20px; }
  .fields { display: grid; grid-template-columns: minmax(0, 1fr) 120px; gap: 12px; }
  label { display: grid; gap: 6px; color: var(--text-muted); font-size: var(--text-xs); }
  input { width: 100%; box-sizing: border-box; min-height: 34px; }

  .preview {
    display: grid;
    gap: 5px;
    max-height: 240px;
    overflow: auto;
    padding: 10px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: var(--surface-2);
  }

  .preview div {
    display: flex;
    gap: 5px;
    color: var(--text-muted);
    font-size: var(--text-xs);
  }

  .preview strong { color: var(--text-color); font-variant-numeric: tabular-nums; }
  .preview p { margin: 0; }
  footer { display: flex; justify-content: flex-end; gap: 8px; }

  footer button {
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--border-color);
    border-radius: 5px;
    cursor: pointer;
  }

  .secondary { background: var(--surface-2); color: var(--text-muted); }
  .primary { border-color: var(--accent); background: var(--accent); color: var(--bg-panel); font-weight: 650; }
  footer button:disabled { cursor: default; opacity: .5; }

  @media (max-width: 460px) {
    .fields { grid-template-columns: 1fr; }
  }
</style>
