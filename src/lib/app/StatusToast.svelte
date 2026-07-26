<script>
  import { CircleAlert, CircleCheck, Info } from "@lucide/svelte";
  let { message = "" } = $props();
  let tone = $derived(/failed|error|err |conflict|invalid|missing/i.test(message) ? "error" : /created|rebuilt|on$|off$/i.test(message) ? "success" : "info");
  let Icon = $derived(tone === "error" ? CircleAlert : tone === "success" ? CircleCheck : Info);
</script>

{#if message}
  <div class="status-toast" class:error={tone === "error"} class:success={tone === "success"} role="status" aria-live="polite">
    <Icon size={14} />
    <span>{message}</span>
  </div>
{/if}

<style>
  .status-toast {
    position: fixed;
    right: 14px;
    bottom: 14px;
    z-index: var(--layer-toast);
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: min(420px, calc(100vw - 28px));
    min-height: 34px;
    padding: 7px 11px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--surface-2);
    color: var(--text-color);
    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.36);
    box-sizing: border-box;
    font-size: var(--text-sm);
  }
  .status-toast :global(svg) { flex: none; color: var(--accent); }
  .status-toast.success :global(svg) { color: var(--success); }
  .status-toast.error { border-color: rgba(255, 85, 85, 0.45); }
  .status-toast.error :global(svg) { color: var(--danger); }
  span { min-width: 0; overflow-wrap: anywhere; }
</style>
