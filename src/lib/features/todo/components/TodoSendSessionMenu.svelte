<script lang="ts">
import type { DailySession } from "$lib/features/daily/types.ts";
  import { ClipboardList } from "@lucide/svelte";
  import { clampContextMenuPosition } from "$lib/shared/services/contextMenuPosition.ts";

  let {
    x = 0,
    y = 0,
    sessions = [],
    onSelectSession
  }: {
      x?: number;
      y?: number;
      sessions?: DailySession[];
      onSelectSession(id: string): void;
  } = $props();

  let menuElement = $state<HTMLDivElement>();
  let menuLeft = $state(0);
  let menuTop = $state(0);

  $effect(() => {
    const rect = menuElement?.getBoundingClientRect?.();
    const position = clampContextMenuPosition({
      x,
      y,
      width: rect?.width || 196,
      height: rect?.height || 140,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    });
    menuLeft = position.x;
    menuTop = position.y;
  });
</script>

<div
  bind:this={menuElement}
  class="todo-context-menu session-picker-menu"
  style:left={`${menuLeft}px`}
  style:top={`${menuTop}px`}
  role="menu"
  aria-label="Choose activity session"
  tabindex="-1"
  oncontextmenu={(event) => event.preventDefault()}
>
  <div class="context-count">Send to activity</div>
  {#each sessions as session (session.id)}
    <button type="button" role="menuitem" onclick={() => onSelectSession(session.id)} title={session.name}>
      <ClipboardList size={13} />
      <span>{session.name}</span>
    </button>
  {/each}
</div>
