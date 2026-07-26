<script>
  let { open = false, size = 15 } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 16 16"
  fill="none"
  aria-hidden="true"
>
  <rect class="frame" x="1.5" y="2.5" width="13" height="11" rx="2.4" />
  <rect class="divider" class:open x="4" y="4" width="1.5" height="8" rx="0.75" />
</svg>

<style>
  .frame {
    stroke: currentColor;
    stroke-width: 1.45;
  }
  .divider {
    fill: currentColor;
    transform: scaleY(0.38);
    transform-box: fill-box;
    transform-origin: center;
    transition: transform 150ms cubic-bezier(0.2, 0.75, 0.25, 1);
  }
  .divider.open { transform: scaleY(1); }
</style>
