<script>
  // @ts-nocheck
  import { appStore } from "$lib/app/appStore.svelte.js";
  import ContextMenu from "$lib/shared/components/ContextMenu.svelte";
  import {
    noteBlockAtOffset,
    parseNoteMarkdown,
    replaceNoteBlock,
    toggleNoteCheckbox
  } from "$lib/shared/parsers/noteMarkdown.js";
  import { captureEditableText } from "$lib/shared/services/editableTextClipboard.js";
  import { buildEditableTextMenuItems } from "$lib/shared/services/editableTextMenuItems.js";

  let { value = "", onChange, label = "Notes" } = $props();

  let editorValue = $state("");
  let lastIncomingValue = $state(null);
  let editing = $state(false);
  let activeBlockStart = $state(0);
  let activeTextarea = $state(null);
  let pendingSelectionStart = $state(0);
  let pendingSelectionEnd = $state(0);
  let showHelp = $state(false);
  let containerEl = $state(null);
  let contextMenu = $state(null);
  let measuredTextareaHeight = $state(0);

  let parsedBlocks = $derived(parseNoteMarkdown(editorValue));
  let activeBlock = $derived(
    editing
      ? parsedBlocks.find((block) => block.start === activeBlockStart) ?? parsedBlocks[0] ?? null
      : null
  );
  let contextMenuItems = $derived.by(() => {
    return buildEditableTextMenuItems(contextMenu?.editable, {
      beforeAction: closeContextMenu,
      onError: (error) => appStore.showStatus(`Clipboard failed: ${error}`),
      includeSelectAll: false,
      trailingSeparator: false
    });
  });

  $effect(() => {
    const incoming = value;
    if (incoming === lastIncomingValue) return;
    lastIncomingValue = incoming;
    editorValue = incoming;
  });

  $effect(() => {
    const textarea = activeTextarea;
    const start = activeBlockStart;
    if (!editing || !textarea) return;

    textarea.focus();
    const selectionStart = Math.min(pendingSelectionStart, textarea.value.length);
    const selectionEnd = Math.min(pendingSelectionEnd, textarea.value.length);
    textarea.setSelectionRange(selectionStart, selectionEnd);
  });

  $effect(() => {
    const currentValue = editorValue;
    const start = activeBlockStart;
    const textarea = activeTextarea;
    if (!editing || !textarea) {
      measuredTextareaHeight = 0;
      return;
    }

    const previousHeight = measuredTextareaHeight;
    textarea.style.height = "auto";
    const nextHeight = Math.max(textarea.scrollHeight, 30);
    textarea.style.height = `${nextHeight}px`;
    measuredTextareaHeight = nextHeight;

    if (!currentValue || previousHeight <= 0 || nextHeight <= previousHeight) return;
    requestAnimationFrame(() => {
      if (document.activeElement !== textarea || textarea.selectionEnd !== textarea.value.length) return;
      const scrollPanel = textarea.closest(".panel-scroll");
      if (!scrollPanel) return;
      const gap = parseFloat(getComputedStyle(textarea).getPropertyValue("--panel-bottom-gap")) || 22;
      const missing = textarea.getBoundingClientRect().bottom + gap - scrollPanel.getBoundingClientRect().bottom;
      if (missing > 0) scrollPanel.scrollTop += missing;
    });
  });

  function emitValue(nextValue) {
    editorValue = nextValue;
    onChange(nextValue);
  }

  function activateBlock(block, selection = block.contentStart ?? 0) {
    editing = true;
    activeBlockStart = block.start;
    pendingSelectionStart = selection;
    pendingSelectionEnd = selection;
  }

  function activateAtGlobalOffset(nextValue, globalOffset) {
    const nextBlocks = parseNoteMarkdown(nextValue);
    const nextBlock = noteBlockAtOffset(nextBlocks, globalOffset) ?? nextBlocks.at(-1);
    if (!nextBlock) return;

    activeBlockStart = nextBlock.start;
    pendingSelectionStart = Math.max(0, globalOffset - nextBlock.start);
    pendingSelectionEnd = pendingSelectionStart;
  }

  function handleSurfaceClick(event) {
    if (event.target.tagName === "INPUT" || event.target.closest(".help-container")) return;
    const lineEl = event.target.closest(".note-block");
    if (!lineEl) {
      if (!editorValue && parsedBlocks[0]) activateBlock(parsedBlocks[0], 0);
      return;
    }

    const blockStart = Number(lineEl.dataset.start);
    const block = parsedBlocks.find((item) => item.start === blockStart);
    if (block) activateBlock(block);
  }

  function handleEditorInput(event, block) {
    const textarea = event.currentTarget;
    const nextValue = replaceNoteBlock(editorValue, block, textarea.value);
    const globalOffset = block.start + textarea.selectionStart;
    activateAtGlobalOffset(nextValue, globalOffset);
    emitValue(nextValue);
  }

  function handleCheckboxToggle(event, block) {
    event.stopPropagation();
    emitValue(toggleNoteCheckbox(editorValue, block));
  }

  function moveToSibling(block, direction) {
    const index = parsedBlocks.findIndex((item) => item.start === block.start);
    const sibling = parsedBlocks[index + direction];
    if (!sibling) return false;
    activateBlock(sibling, direction < 0 ? sibling.raw.length : sibling.contentStart ?? 0);
    return true;
  }

  function mergeWithPrevious(block) {
    const index = parsedBlocks.findIndex((item) => item.start === block.start);
    const previous = parsedBlocks[index - 1];
    if (!previous) return false;

    const mergedRaw = `${previous.raw}${block.raw}`;
    const nextValue = `${editorValue.slice(0, previous.start)}${mergedRaw}${editorValue.slice(block.end)}`;
    const caretOffset = previous.start + previous.raw.length;
    activateAtGlobalOffset(nextValue, caretOffset);
    emitValue(nextValue);
    return true;
  }

  function mergeWithNext(block) {
    const index = parsedBlocks.findIndex((item) => item.start === block.start);
    const next = parsedBlocks[index + 1];
    if (!next) return false;

    const mergedRaw = `${block.raw}${next.raw}`;
    const nextValue = `${editorValue.slice(0, block.start)}${mergedRaw}${editorValue.slice(next.end)}`;
    const caretOffset = block.end;
    activateAtGlobalOffset(nextValue, caretOffset);
    emitValue(nextValue);
    return true;
  }

  function handleKeyDown(event, block) {
    const target = event.currentTarget;
    const hasSelection = target.selectionStart !== target.selectionEnd;

    if (event.key === "Escape") {
      event.preventDefault();
      editing = false;
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const start = target.selectionStart;
      const end = target.selectionEnd;
      target.setRangeText("  ", start, end, "end");
      handleEditorInput({ currentTarget: target }, block);
      return;
    }

    if (!hasSelection && event.key === "ArrowUp" && target.selectionStart === 0) {
      if (moveToSibling(block, -1)) event.preventDefault();
    } else if (!hasSelection && event.key === "ArrowDown" && target.selectionEnd === target.value.length) {
      if (moveToSibling(block, 1)) event.preventDefault();
    } else if (!hasSelection && event.key === "Backspace" && target.selectionStart === 0) {
      if (mergeWithPrevious(block)) event.preventDefault();
    } else if (!hasSelection && event.key === "Delete" && target.selectionEnd === target.value.length) {
      if (mergeWithNext(block)) event.preventDefault();
    }
  }

  /** @param {FocusEvent} event */
  function handleFocusOut(event) {
    if (containerEl && event.relatedTarget && containerEl.contains(event.relatedTarget)) return;

    setTimeout(() => {
      if (containerEl && !containerEl.contains(document.activeElement)) editing = false;
    }, 0);
  }

  function openContextMenu(event) {
    event.preventDefault();
    contextMenu = {
      x: event.clientX,
      y: event.clientY,
      editable: captureEditableText(event.currentTarget)
    };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function parseInline(text) {
    if (!text) return "";
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");
    escaped = escaped.replace(/_(.*?)_/g, "<em>$1</em>");
    return escaped.replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');
  }
</script>

<div class="notes-container" bind:this={containerEl} onfocusout={handleFocusOut}>
  <header class="notes-header">
    <label for="notes-area">{label}</label>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="help-container" onmouseenter={() => showHelp = true} onmouseleave={() => showHelp = false}>
      <button class="help-btn" type="button" aria-label="Formatting help">?</button>
      {#if showHelp}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="help-popover" onmousedown={(event) => event.preventDefault()}>
          <h3>Formatting Guide</h3>
          <ul>
            <li><span>Headings:</span> <code># H1</code> through <code>###### H6</code></li>
            <li><span>Bullets:</span> <code>- item</code> or <code>* item</code></li>
            <li><span>Numbered:</span> <code>1. item</code></li>
            <li><span>Todo items:</span> <code>- [ ] todo</code> or <code>- [x] done</code></li>
            <li><span>Bold:</span> <code>**text**</code></li>
            <li><span>Italic:</span> <code>*text*</code> or <code>_text_</code></li>
            <li><span>Quote:</span> <code>&gt; text</code></li>
            <li><span>Code fence:</span> <code>```js</code> through <code>```</code></li>
          </ul>
          <div class="help-warning">Links are displayed as plain text.</div>
        </div>
      {/if}
    </div>
  </header>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="notes-surface"
    class:editing
    onclick={handleSurfaceClick}
    role="document"
    aria-label={`${label} live preview`}
  >
    {#if !editorValue && !editing}
      <div class="notes-placeholder">Click to add notes...</div>
    {:else}
      {#each parsedBlocks as block (`${block.start}-${block.type}`)}
        {#if activeBlock?.start === block.start}
        <textarea
          id="notes-area"
          class="block-editor"
          class:code-editor={block.type === "codeblock"}
          bind:this={activeTextarea}
          value={block.raw}
          aria-label={label}
          oninput={(event) => handleEditorInput(event, block)}
          onkeydown={(event) => handleKeyDown(event, block)}
          oncontextmenu={openContextMenu}
          placeholder="Type notes here..."
        ></textarea>
        {:else if block.type === "heading"}
          <div class="note-block heading-line" data-start={block.start}>
            <svelte:element this={`h${block.level}`} class="note-heading level-{block.level}">{@html parseInline(block.content)}</svelte:element>
          </div>
        {:else if block.type === "checkbox"}
          <div class="note-block checkbox-line" style="padding-left: {block.indent}px;" data-start={block.start}>
            <input type="checkbox" checked={block.checked} onclick={(event) => handleCheckboxToggle(event, block)} />
            <span class="note-text" class:checked={block.checked}>{@html parseInline(block.content)}</span>
          </div>
        {:else if block.type === "bullet"}
          <div class="note-block bullet-line" style="padding-left: {block.indent}px;" data-start={block.start}>
            <span class="bullet-dot">•</span>
            <span class="note-text">{@html parseInline(block.content)}</span>
          </div>
        {:else if block.type === "ordered"}
          <div class="note-block ordered-line" style="padding-left: {block.indent}px;" data-start={block.start}>
            <span class="ordered-marker">{block.marker}</span>
            <span class="note-text">{@html parseInline(block.content)}</span>
          </div>
        {:else if block.type === "blockquote"}
          <div class="note-block blockquote-line" style="padding-left: {block.indent}px;" data-start={block.start}>
            <blockquote class="note-blockquote">{@html parseInline(block.content)}</blockquote>
          </div>
        {:else if block.type === "codeblock"}
          <div class="note-block codeblock-line" data-start={block.start}>
            <pre class="note-codeblock">{#if block.language}<span class="code-language">{block.language}</span>{/if}<code>{block.content}</code></pre>
          </div>
        {:else if block.type === "hr"}
          <div class="note-block hr-line" data-start={block.start}><hr class="note-hr" /></div>
        {:else if block.type === "blank"}
          <div class="note-block blank-line" data-start={block.start}>&nbsp;</div>
        {:else}
          <div class="note-block paragraph-line" data-start={block.start}>
            <p class="note-paragraph">{@html parseInline(block.content)}</p>
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  {#if contextMenu}
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      items={contextMenuItems}
      ariaLabel="Notes text actions"
      preserveFocus={true}
      onDismiss={closeContextMenu}
    />
  {/if}
</div>

<style>
  .notes-container {
    display: grid;
    gap: 8px;
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }
  .notes-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
  label {
    color: var(--text-muted);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .help-container {
    position: relative;
    display: flex;
    align-items: center;
  }
  .help-btn {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border: 1px solid var(--border-color);
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .help-btn:hover {
    border-color: var(--text-muted);
    color: var(--text-color);
    background: var(--surface-hover);
  }
  .help-popover {
    position: absolute;
    right: 0;
    bottom: calc(100% + 6px);
    z-index: 100;
    width: 240px;
    padding: 12px;
    background: #181818;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    color: var(--text-color);
    font-size: 11px;
    pointer-events: auto;
  }
  .help-popover h3 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
  }
  .help-popover ul {
    display: grid;
    gap: 4px;
    margin: 0 0 10px;
    padding: 0;
    list-style: none;
  }
  .help-popover li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-muted);
  }
  .help-popover code {
    padding: 1px 4px;
    border-radius: 3px;
    background: #242424;
    color: var(--accent);
    font-family: var(--font-mono);
  }
  .help-warning {
    padding-top: 8px;
    border-top: 1px solid #2d2d2d;
    color: #e5c07b;
    font-weight: 500;
    line-height: 1.4;
  }

  .notes-surface {
    width: 100%;
    min-height: 150px;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-dark);
    color: var(--text-color);
    box-sizing: border-box;
    cursor: text;
    font-size: 13px;
    line-height: 1.6;
    outline: none;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }
  .notes-surface:hover {
    border-color: #444;
    background: rgba(255, 255, 255, 0.01);
  }
  .notes-surface.editing {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }

  .block-editor {
    display: block;
    width: 100%;
    min-height: 30px;
    margin: 0;
    padding: 2px 0;
    resize: none;
    overflow: hidden;
    border: 0;
    background: transparent;
    color: var(--text-color);
    box-sizing: border-box;
    font: 12px/1.6 var(--font-mono);
    overflow-wrap: anywhere;
    outline: none;
  }
  .block-editor.code-editor {
    min-height: 54px;
    margin: 4px 0;
    padding: 10px 12px;
    border: 1px solid #343434;
    border-radius: var(--radius-md);
    background: #121212;
  }
  .notes-placeholder {
    padding: 8px 0;
    color: var(--text-muted);
    font-style: italic;
  }
  .note-block {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
    min-height: 20px;
    padding: 2px 0;
    box-sizing: border-box;
  }
  .note-text {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .note-text.checked {
    color: var(--text-muted);
    text-decoration: line-through;
    opacity: 0.6;
  }
  .bullet-dot {
    margin-right: 2px;
    color: var(--accent);
    font-weight: 700;
    user-select: none;
  }
  .ordered-marker {
    flex: 0 0 auto;
    min-width: 1.5em;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
    user-select: none;
  }
  .checkbox-line input[type="checkbox"] {
    margin-top: 4px;
    cursor: pointer;
    accent-color: var(--accent);
  }
  .note-blockquote {
    width: 100%;
    margin: 0;
    padding: 4px 12px;
    border-left: 2px solid var(--accent);
    border-radius: 0 4px 4px 0;
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-muted);
    box-sizing: border-box;
    font-style: italic;
    overflow-wrap: anywhere;
  }
  .note-codeblock {
    position: relative;
    width: 100%;
    margin: 6px 0;
    padding: 10px 14px;
    overflow-x: auto;
    border: 1px solid #282828;
    border-radius: var(--radius-md);
    background: #121212;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.5;
  }
  .note-codeblock code {
    display: block;
    white-space: pre;
  }
  .code-language {
    display: block;
    margin-bottom: 6px;
    color: var(--text-muted);
    font-size: 10px;
    line-height: 1;
    text-transform: uppercase;
  }
  .note-hr {
    width: 100%;
    margin: 12px 0;
    border: 0;
    border-top: 1px solid var(--border-color);
  }
  .note-paragraph {
    width: 100%;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .note-heading {
    margin: 0;
    color: var(--text-primary);
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .note-heading.level-1 { font-size: 1.45em; }
  .note-heading.level-2 { font-size: 1.3em; }
  .note-heading.level-3 { font-size: 1.18em; }
  .note-heading.level-4 { font-size: 1.08em; }
  .note-heading.level-5 { font-size: 1em; }
  .note-heading.level-6 { color: var(--text-muted); font-size: .92em; }
  .blank-line { height: 12px; }

  :global(.inline-code) {
    padding: 2px 4px;
    border-radius: 3px;
    background: #242424;
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 11px;
  }
</style>
