<script lang="ts">
import type { RawLine } from "../types.ts";
  import { Trash2 } from "@lucide/svelte";

  let { rawLine, index, onDeleteTodo, onRawContextMenu }: {

      rawLine: RawLine;

      index: number;

      onDeleteTodo(index: number): unknown;

      onRawContextMenu(event: MouseEvent): void;

  } = $props();
</script>

<div class="raw-row" oncontextmenu={onRawContextMenu} role="listitem">
  <span class="raw-text">{rawLine.raw}</span>
  <div class="row-actions">
    <button class="row-btn del" onclick={() => onDeleteTodo(index)} title="Delete">
      <Trash2 size={13} />
    </button>
  </div>
</div>
