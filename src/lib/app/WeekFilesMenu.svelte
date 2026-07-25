<script>
  // @ts-nocheck
  import { CalendarCheck2, CalendarPlus2, CalendarRange } from "@lucide/svelte";
  import { clampContextMenuPosition } from "$lib/shared/services/contextMenuPosition.js";

  let { x = 0, y = 0, onCurrent, onNext, onChoose } = $props();
  const width = 206;
  const height = 118;
  let position = $derived(clampContextMenuPosition({
    x,
    y,
    width,
    height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  }));

</script>

<div
  class="week-files-menu"
  data-week-files-menu
  style:left={`${position.x}px`}
  style:top={`${position.y}px`}
  role="menu"
  aria-label="Week files"
>
  <button type="button" role="menuitem" onclick={onCurrent}>
    <CalendarCheck2 size={13} /><span>Current week — check/repair</span>
  </button>
  <button type="button" role="menuitem" onclick={onNext}>
    <CalendarPlus2 size={13} /><span>Next week — create</span>
  </button>
  <button type="button" role="menuitem" onclick={onChoose}>
    <CalendarRange size={13} /><span>Choose weeks…</span>
  </button>
</div>

<style>
  .week-files-menu {
    position: fixed;
    z-index: 1000;
    display: grid;
    width: 206px;
    padding: 4px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--bg-header);
    box-shadow: 0 10px 24px rgba(0, 0, 0, .38);
  }

  button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 34px;
    padding: 6px 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 650;
    text-align: left;
    cursor: pointer;
  }

  button:hover,
  button:focus-visible {
    outline: 0;
    background: var(--surface-hover);
    color: var(--text-color);
  }
</style>
