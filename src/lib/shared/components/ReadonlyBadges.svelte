<script>
  // @ts-nocheck
  let { subjects = [], minutes = null, placeholder = "-" } = $props();
  const visibleSubjects = $derived(subjects.length ? subjects : [placeholder]);
</script>

<div class="readonly-badges">
  {#if minutes !== null}
    <span class="time-badge">{minutes}m</span>
  {/if}
  {#each visibleSubjects as subject}
    <span class="subject-badge" class:placeholder={subject === placeholder} title={subject}>{subject}</span>
  {/each}
</div>

<style>
  .readonly-badges {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    min-width: 0;
  }

  .subject-badge,
  .time-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
    max-width: 180px;
    height: 24px;
    padding: 0 8px;
    border: 1px solid #2d2d2d;
    border-radius: 4px;
    background: #121212;
    color: #b3b3b3;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    box-sizing: border-box;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .time-badge {
    color: var(--text-muted);
    border-color: #3d3d3d;
    background: transparent;
  }

  .subject-badge.placeholder {
    color: var(--text-muted);
    border-style: dashed;
    background: transparent;
  }
</style>
