<script>
  // @ts-nocheck
  import { CalendarDays, ChevronLeft, ChevronRight, Minus, Plus, X } from "@lucide/svelte";
  import {
    getConsecutiveWeekDescriptors,
    getWeekDescriptor
  } from "$lib/shared/services/logWorkspaceService.js";

  let { onClose, onSubmit } = $props();
  let selectedDate = $state(new Date());
  let calendarMonth = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  let weekCount = $state(1);
  let calendarOpen = $state(false);
  let submitting = $state(false);

  let selectedWeek = $derived(getWeekDescriptor(selectedDate));
  let selection = $derived({
    year: selectedWeek.year,
    week: selectedWeek.week,
    count: weekCount,
    descriptors: getConsecutiveWeekDescriptors(selectedWeek.start, weekCount)
  });
  let calendarTitle = $derived(new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric"
  }).format(calendarMonth));
  let calendarWeeks = $derived.by(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    first.setDate(first.getDate() - ((first.getDay() || 7) - 1));
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(first);
      date.setDate(date.getDate() + index * 7);
      return getWeekDescriptor(date);
    });
  });

  function moveStartWeek(offset) {
    const next = new Date(selectedWeek.start);
    next.setDate(next.getDate() + offset * 7);
    selectedDate = next;
    calendarMonth = new Date(next.getFullYear(), next.getMonth(), 1);
  }

  function moveCalendarMonth(offset) {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
  }

  function selectWeek(descriptor) {
    selectedDate = new Date(descriptor.start);
    calendarMonth = new Date(descriptor.start.getFullYear(), descriptor.start.getMonth(), 1);
    calendarOpen = false;
  }

  function selectCurrentWeek() {
    selectWeek(getWeekDescriptor(new Date()));
  }

  function changeWeekCount(offset) {
    weekCount = Math.min(12, Math.max(1, weekCount + offset));
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    const completed = await onSubmit(selection.year, selection.week, selection.count);
    submitting = false;
    if (completed) onClose();
  }

  function handleKeydown(event) {
    if (event.key !== "Escape") return;
    if (calendarOpen) {
      calendarOpen = false;
      return;
    }
    onClose();
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
      <button type="button" class="icon-btn close-btn" onclick={onClose} aria-label="Close"><X size={16} /></button>
    </header>

    <form onsubmit={submit}>
      <div class="fields">
        <div class="field week-field">
          <span class="field-label">Start week</span>
          <div class="week-control">
            <button type="button" class="icon-btn" onclick={() => moveStartWeek(-1)} aria-label="Previous start week">
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              class="week-display"
              onclick={() => calendarOpen = !calendarOpen}
              aria-label={`Choose start week, Week ${selectedWeek.week}, ${selectedWeek.year}`}
              aria-expanded={calendarOpen}
            >
              <span>Week {selectedWeek.week}, {selectedWeek.year}</span>
              <small>{selectedWeek.rangeLabel}</small>
            </button>
            <button type="button" class="icon-btn" onclick={() => moveStartWeek(1)} aria-label="Next start week">
              <ChevronRight size={16} />
            </button>
          </div>

          {#if calendarOpen}
            <div class="calendar-popover" role="group" aria-label="Choose start week">
              <div class="calendar-header">
                <button type="button" class="icon-btn" onclick={() => moveCalendarMonth(-1)} aria-label="Previous month">
                  <ChevronLeft size={15} />
                </button>
                <strong>{calendarTitle}</strong>
                <button type="button" class="icon-btn" onclick={() => moveCalendarMonth(1)} aria-label="Next month">
                  <ChevronRight size={15} />
                </button>
              </div>
              <div class="weekday-row" aria-hidden="true">
                <span>W</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
              </div>
              <div class="calendar-weeks">
                {#each calendarWeeks as descriptor}
                  <button
                    type="button"
                    class:selected={descriptor.year === selectedWeek.year && descriptor.week === selectedWeek.week}
                    aria-label={`Select Week ${descriptor.week}, ${descriptor.year}: ${descriptor.rangeLabel}`}
                    onclick={() => selectWeek(descriptor)}
                  >
                    <span class="week-number">{descriptor.week}</span>
                    {#each descriptor.dates as date}
                      <span class:outside={date.getMonth() !== calendarMonth.getMonth()}>{date.getDate()}</span>
                    {/each}
                  </button>
                {/each}
              </div>
              <button type="button" class="this-week" onclick={selectCurrentWeek}>
                <CalendarDays size={14} /> This week
              </button>
            </div>
          {/if}
        </div>

        <div class="field count-field">
          <span class="field-label">Number of weeks</span>
          <div class="stepper" role="group" aria-label="Number of weeks">
            <button
              type="button"
              onclick={() => changeWeekCount(-1)}
              aria-label="Decrease number of weeks"
              disabled={weekCount === 1}
            ><Minus size={14} /></button>
            <output aria-label={`${weekCount} weeks`}>{weekCount}</output>
            <button
              type="button"
              onclick={() => changeWeekCount(1)}
              aria-label="Increase number of weeks"
              disabled={weekCount === 12}
            ><Plus size={14} /></button>
          </div>
        </div>
      </div>

      <div class="preview" aria-label="Selected weeks">
        {#each selection.descriptors as descriptor}
          <div aria-label={`${descriptor.folderName} · ${descriptor.rangeLabel}`}>
            <strong>{descriptor.folderName}</strong><span>· {descriptor.rangeLabel}</span>
          </div>
        {/each}
      </div>

      <footer>
        <button type="button" class="secondary" onclick={onClose}>Cancel</button>
        <button type="submit" class="primary" disabled={submitting}>
          {submitting
            ? "Working…"
            : `Check/repair ${selection.count} ${selection.count === 1 ? "week" : "weeks"}`}
        </button>
      </footer>
    </form>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 1px;
    z-index: 1100;
    display: grid;
    place-items: center;
    padding: 20px;
    border-radius: 8px;
    background: rgba(0, 0, 0, .62);
  }

  :global(.app-container.maximized) .backdrop {
    inset: 0;
    border-radius: 0;
  }

  .dialog {
    width: min(440px, 100%);
    max-height: min(650px, calc(100vh - 40px));
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
  form { display: grid; gap: 16px; padding: 18px 20px 20px; }
  .fields { display: grid; grid-template-columns: minmax(0, 1fr) 124px; gap: 12px; align-items: start; }
  .field { position: relative; display: grid; gap: 6px; min-width: 0; }
  .field-label { color: var(--text-muted); font-size: var(--text-xs); }

  .icon-btn {
    display: grid;
    place-items: center;
    flex: none;
    width: 32px;
    height: 34px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .icon-btn:hover { background: var(--surface-hover); color: var(--text-color); }
  .icon-btn:focus-visible, .week-display:focus-visible, .stepper button:focus-visible,
  .calendar-weeks button:focus-visible, .this-week:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: -1px;
  }

  .close-btn { width: 28px; height: 28px; border-radius: 5px; }
  .week-control {
    display: flex;
    min-height: 42px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--surface-2);
  }

  .week-control > .icon-btn { height: 42px; }
  .week-display {
    display: grid;
    flex: 1;
    min-width: 0;
    place-content: center;
    gap: 2px;
    padding: 4px 6px;
    border: 0;
    border-right: 1px solid var(--border-subtle);
    border-left: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-color);
    text-align: center;
    cursor: pointer;
  }

  .week-display span { font-size: var(--text-sm); font-weight: 650; }
  .week-display small {
    overflow: hidden;
    color: var(--text-muted);
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stepper {
    display: grid;
    grid-template-columns: 34px 1fr 34px;
    min-height: 42px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--surface-2);
  }

  .stepper button {
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .stepper button:first-child { border-right: 1px solid var(--border-subtle); }
  .stepper button:last-child { border-left: 1px solid var(--border-subtle); }
  .stepper button:hover:not(:disabled) { background: var(--surface-hover); color: var(--text-color); }
  .stepper button:disabled { cursor: default; opacity: .3; }
  .stepper output {
    display: grid;
    place-items: center;
    color: var(--text-color);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    font-weight: 650;
  }

  .calendar-popover {
    position: absolute;
    z-index: 2;
    top: calc(100% + 6px);
    left: 0;
    width: min(310px, calc(100vw - 64px));
    box-sizing: border-box;
    padding: 8px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-2);
    box-shadow: 0 12px 28px rgba(0, 0, 0, .42);
  }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 5px;
  }

  .calendar-header strong { font-size: var(--text-sm); font-weight: 650; }
  .calendar-header .icon-btn { width: 28px; height: 28px; border-radius: 4px; }
  .weekday-row, .calendar-weeks button {
    display: grid;
    grid-template-columns: 24px repeat(7, 1fr);
    align-items: center;
    text-align: center;
  }

  .weekday-row {
    padding: 0 3px 4px;
    color: var(--text-dim);
    font-size: 9px;
  }

  .calendar-weeks { display: grid; gap: 2px; }
  .calendar-weeks button {
    min-height: 28px;
    padding: 0 3px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-size: 10px;
    cursor: pointer;
  }

  .calendar-weeks button:hover { background: var(--surface-hover); color: var(--text-color); }
  .calendar-weeks button.selected {
    border-color: color-mix(in srgb, var(--accent) 48%, transparent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--text-color);
  }

  .calendar-weeks .week-number { color: var(--accent); font-weight: 700; }
  .calendar-weeks .outside { color: var(--text-dim); opacity: .5; }
  .this-week {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    min-height: 28px;
    margin-top: 6px;
    border: 0;
    border-top: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-muted);
    font-size: var(--text-xs);
    cursor: pointer;
  }

  .this-week:hover { color: var(--text-color); }
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

  .preview div { display: flex; gap: 5px; color: var(--text-muted); font-size: var(--text-xs); }
  .preview strong { color: var(--text-color); font-variant-numeric: tabular-nums; }
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
    .count-field { width: 124px; }
  }
</style>
