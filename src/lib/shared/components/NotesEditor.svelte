<script>
  // @ts-nocheck
  let { value = "", onChange, label = "Notes" } = $props();

  let editing = $state(false);
  let showHelp = $state(false);
  let containerEl = $state(null);
  let textareaEl = $state(null);
  let pendingCaretPosition = $state(-1);
  let measuredTextareaHeight = 0;

  // Parse raw markdown text into structured blocks
  function parseMarkdown(text) {
    if (!text) return [];
    const lines = text.split("\n");
    const blocks = [];
    let inCodeBlock = false;
    let codeBlockContent = [];
    let codeBlockIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle fenced code blocks (```)
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          // Close code block
          blocks.push({
            type: "codeblock",
            content: codeBlockContent.join("\n"),
            index: codeBlockIndex
          });
          inCodeBlock = false;
          codeBlockContent = [];
          codeBlockIndex = -1;
        } else {
          // Open code block
          inCodeBlock = true;
          codeBlockIndex = i;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      const trimmed = line.trim();

      // Checkboxes: - [ ] or - [x]
      if (trimmed.startsWith("- [ ] ") || trimmed.startsWith("- [x] ")) {
        const checked = trimmed.startsWith("- [x] ");
        const leadingSpaceCount = line.length - line.trimStart().length;
        const content = line.substring(leadingSpaceCount + 6);
        blocks.push({
          type: "checkbox",
          checked,
          content,
          indent: leadingSpaceCount * 12, // Indentation multiplier in pixels
          index: i
        });
        continue;
      }

      // Bullet lists: - or *
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const leadingSpaceCount = line.length - line.trimStart().length;
        const content = line.substring(leadingSpaceCount + 2);
        blocks.push({
          type: "bullet",
          content,
          indent: leadingSpaceCount * 12,
          index: i
        });
        continue;
      }

      // Blockquotes: >
      if (trimmed.startsWith("> ")) {
        const leadingSpaceCount = line.length - line.trimStart().length;
        const content = line.substring(leadingSpaceCount + 2);
        blocks.push({
          type: "blockquote",
          content,
          indent: leadingSpaceCount * 12,
          index: i
        });
        continue;
      }

      // Horizontal Rules: ---
      if (trimmed === "---") {
        blocks.push({
          type: "hr",
          index: i
        });
        continue;
      }

      // Blank lines
      if (trimmed === "") {
        blocks.push({
          type: "blank",
          index: i
        });
        continue;
      }

      // Regular Paragraph
      blocks.push({
        type: "paragraph",
        content: line,
        index: i
      });
    }

    // If still in code block at EOF, close it
    if (inCodeBlock) {
      blocks.push({
        type: "codeblock",
        content: codeBlockContent.join("\n"),
        index: codeBlockIndex
      });
    }

    return blocks;
  }

  // Parse inline styles (bold, italic, inline code)
  function parseInline(text) {
    if (!text) return "";

    // Escape HTML to prevent injection
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Bold: **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Italic: *text* or _text_
    escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");
    escaped = escaped.replace(/_(.*?)_/g, "<em>$1</em>");

    // Inline code: `code`
    escaped = escaped.replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');

    return escaped;
  }

  let parsedBlocks = $derived(parseMarkdown(value));

  // Auto-focus and caret positioning effect
  $effect(() => {
    if (editing && textareaEl) {
      textareaEl.focus();
      if (pendingCaretPosition !== -1) {
        textareaEl.selectionStart = pendingCaretPosition;
        textareaEl.selectionEnd = pendingCaretPosition;
        pendingCaretPosition = -1; // Reset
      }
    }
  });

  // Auto-resize effect for textarea height
  $effect(() => {
    const val = value;
    if (!textareaEl) {
      measuredTextareaHeight = 0;
      return;
    }

    const previousHeight = measuredTextareaHeight;
    textareaEl.style.height = "auto";
    const nextHeight = textareaEl.scrollHeight;
    textareaEl.style.height = nextHeight + "px";
    measuredTextareaHeight = nextHeight;

    if (previousHeight <= 0 || nextHeight <= previousHeight) return;
    const textarea = textareaEl;
    requestAnimationFrame(() => {
      if (document.activeElement !== textarea || textarea.selectionEnd !== textarea.value.length) return;
      const scrollPanel = textarea.closest(".panel-scroll");
      if (!scrollPanel) return;
      const gap = parseFloat(getComputedStyle(textarea).getPropertyValue("--panel-bottom-gap")) || 22;
      const missing = textarea.getBoundingClientRect().bottom + gap - scrollPanel.getBoundingClientRect().bottom;
      if (missing > 0) scrollPanel.scrollTop += missing;
    });
  });

  function handlePreviewClick(event) {
    // Skip transition if clicking a link, checkbox input or the help container
    if (
      event.target.tagName === "INPUT" ||
      event.target.tagName === "A" ||
      event.target.closest(".help-container")
    ) {
      return;
    }

    editing = true;

    // Detect if they clicked on a specific line
    const lineEl = event.target.closest(".note-line");
    if (lineEl) {
      const lineIndex = parseInt(lineEl.dataset.index, 10);
      if (!isNaN(lineIndex)) {
        const lines = value.split("\n");
        let caretPos = 0;
        for (let i = 0; i < lineIndex; i++) {
          caretPos += lines[i].length + 1; // line content + newline character
        }

        // Offset for leading whitespace to put cursor right at the beginning of text
        const leadingWhitespace = lines[lineIndex].length - lines[lineIndex].trimStart().length;
        caretPos += leadingWhitespace;

        pendingCaretPosition = caretPos;
        return;
      }
    }

    // Default fallback: clicked placeholder or empty space, place at end
    pendingCaretPosition = value.length;
  }

  function handleCheckboxToggle(event, lineIndex) {
    event.stopPropagation(); // Do not trigger line editing
    const lines = value.split("\n");
    const line = lines[lineIndex];
    if (line) {
      const trimmed = line.trim();
      let updatedLine;
      if (trimmed.startsWith("- [ ] ")) {
        updatedLine = line.replace("- [ ] ", "- [x] ");
      } else if (trimmed.startsWith("- [x] ")) {
        updatedLine = line.replace("- [x] ", "- [ ] ");
      } else {
        return;
      }
      lines[lineIndex] = updatedLine;
      onChange(lines.join("\n"));
    }
  }

  /** @param {FocusEvent} event */
  function handleFocusOut(event) {
    if (containerEl && event.relatedTarget && containerEl.contains(event.relatedTarget)) {
      return;
    }

    setTimeout(() => {
      if (containerEl && !containerEl.contains(document.activeElement)) {
        editing = false;
      }
    }, 0);
  }

  /** @param {KeyboardEvent} event */
  function handleKeyDown(event) {
    if (event.key === "Escape") {
      editing = false;
    } else if (event.key === "Tab") {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      target.value = `${target.value.slice(0, start)}  ${target.value.slice(end)}`;
      target.selectionStart = target.selectionEnd = start + 2;
      onChange(target.value);
    }
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
        <div class="help-popover" onmousedown={(e) => e.preventDefault()}>
          <h3>Formatting Guide</h3>
          <ul>
            <li><span>Bullets:</span> <code>- item</code> or <code>* item</code></li>
            <li><span>Todo items:</span> <code>- [ ] todo</code> or <code>- [x] done</code></li>
            <li><span>Bold:</span> <code>**text**</code></li>
            <li><span>Italic:</span> <code>*text*</code> or <code>_text_</code></li>
            <li><span>Quote:</span> <code>&gt; text</code></li>
            <li><span>Code:</span> <code>`code`</code> or <code>``` codeblock ```</code></li>
          </ul>
          <div class="help-warning">
            Warning: Do not use headers (#) or links.
          </div>
        </div>
      {/if}
    </div>
  </header>

  {#if editing}
    <textarea
      id="notes-area"
      bind:this={textareaEl}
      value={value}
      oninput={(e) => onChange(e.currentTarget.value)}
      onkeydown={handleKeyDown}
      placeholder="Type notes here..."
    ></textarea>
  {:else}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="notes-preview" onclick={handlePreviewClick} role="document" tabindex="0">
      {#each parsedBlocks as block}
        {#if block.type === "checkbox"}
          <div class="note-line checkbox-line" style="padding-left: {block.indent}px;" data-index={block.index}>
            <input
              type="checkbox"
              checked={block.checked}
              onclick={(e) => handleCheckboxToggle(e, block.index)}
            />
            <span class="note-text" class:checked={block.checked}>{@html parseInline(block.content)}</span>
          </div>
        {:else if block.type === "bullet"}
          <div class="note-line bullet-line" style="padding-left: {block.indent}px;" data-index={block.index}>
            <span class="bullet-dot">•</span>
            <span class="note-text">{@html parseInline(block.content)}</span>
          </div>
        {:else if block.type === "blockquote"}
          <div class="note-line blockquote-line" style="padding-left: {block.indent}px;" data-index={block.index}>
            <blockquote class="note-blockquote">{@html parseInline(block.content)}</blockquote>
          </div>
        {:else if block.type === "codeblock"}
          <div class="note-line codeblock-line" data-index={block.index}>
            <pre class="note-codeblock"><code>{block.content}</code></pre>
          </div>
        {:else if block.type === "hr"}
          <div class="note-line hr-line" data-index={block.index}>
            <hr class="note-hr" />
          </div>
        {:else if block.type === "blank"}
          <div class="note-line blank-line" data-index={block.index}>&nbsp;</div>
        {:else}
          <div class="note-line paragraph-line" data-index={block.index}>
            <p class="note-paragraph">{@html parseInline(block.content)}</p>
          </div>
        {/if}
      {:else}
        <div class="notes-placeholder">Click to add notes...</div>
      {/each}
    </div>
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
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-color);
  }
  .help-popover ul {
    margin: 0 0 10px 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 4px;
  }
  .help-popover li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-muted);
  }
  .help-popover code {
    background: #242424;
    padding: 1px 4px;
    border-radius: 3px;
    font-family: var(--font-mono);
    color: var(--accent);
  }
  .help-warning {
    border-top: 1px solid #2d2d2d;
    padding-top: 8px;
    color: #e5c07b;
    font-weight: 500;
    line-height: 1.4;
  }

  textarea {
    width: 100%;
    min-height: 150px;
    resize: none;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-dark);
    color: var(--text-color);
    padding: 12px;
    font: 12px/1.6 var(--font-mono);
    box-sizing: border-box;
    outline: none;
    overflow-y: hidden;
  }
  textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }

  /* Preview Mode Styling */
  .notes-preview {
    width: 100%;
    min-height: 150px;
    padding: 12px;
    background: var(--bg-dark);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-sizing: border-box;
    cursor: pointer;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-color);
    transition: border-color 0.15s ease, background-color 0.15s ease;
    outline: none;
  }
  .notes-preview:hover {
    border-color: #444;
    background: rgba(255, 255, 255, 0.01);
  }
  .notes-preview:focus-visible {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }

  .notes-placeholder {
    color: var(--text-muted);
    font-style: italic;
    padding: 8px 0;
  }

  .note-line {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-height: 20px;
    padding: 2px 0;
    box-sizing: border-box;
  }

  .note-text {
    flex: 1;
    word-break: break-word;
  }
  .note-text.checked {
    text-decoration: line-through;
    color: var(--text-muted);
    opacity: 0.6;
  }

  /* List styles */
  .bullet-dot {
    color: var(--accent);
    font-weight: bold;
    user-select: none;
    margin-right: 2px;
  }

  /* Checkbox lines */
  .checkbox-line input[type="checkbox"] {
    margin-top: 4px;
    cursor: pointer;
    accent-color: var(--accent);
  }

  /* Quote block styling */
  .note-blockquote {
    margin: 0;
    padding: 4px 12px;
    border-left: 2px solid var(--accent);
    color: var(--text-muted);
    font-style: italic;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 0 4px 4px 0;
    width: 100%;
    box-sizing: border-box;
  }

  /* Code block styling */
  .note-codeblock {
    margin: 6px 0;
    padding: 10px 14px;
    background: #121212;
    border: 1px solid #282828;
    border-radius: var(--radius-md);
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.5;
    width: 100%;
    box-sizing: border-box;
  }

  .note-hr {
    border: 0;
    border-top: 1px solid var(--border-color);
    margin: 12px 0;
    width: 100%;
  }

  .note-paragraph {
    margin: 0;
    width: 100%;
  }

  .blank-line {
    height: 12px;
  }

  :global(.inline-code) {
    font-family: var(--font-mono);
    font-size: 11px;
    background: #242424;
    padding: 2px 4px;
    border-radius: 3px;
    color: var(--accent);
  }
</style>
