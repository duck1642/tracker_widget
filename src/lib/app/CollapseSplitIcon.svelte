<script lang="ts">
import type { SVGAttributes } from "svelte/elements";
  let { size = 24, ...props }: SVGAttributes<SVGSVGElement> & {size?:number} = $props();
</script>

<svg {...props} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect width="18" height="18" x="3" y="3" rx="2" />
  <path d="M15 3v18" />
  <path d="m11 9-3 3 3 3" />
</svg>
