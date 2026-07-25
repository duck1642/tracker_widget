<script>
  // @ts-nocheck
  import { Clock3 } from "@lucide/svelte";
  import { formatDurationSummary } from "$lib/shared/utils/durationSummary.js";

  let { label, summary } = $props();
  let value = $derived(formatDurationSummary(summary, { hours: true }));
</script>

<span class="duration-total" aria-label={`${label}: ${value}`} title={label}>
  <Clock3 size={14} />
  <strong>{value}</strong>
</span>

<style>
  .duration-total {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--accent);
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  strong {
    color: inherit;
    font-variant-numeric: tabular-nums;
  }
</style>
