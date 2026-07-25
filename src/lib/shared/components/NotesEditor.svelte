<script>
  // @ts-nocheck
  import { onMount } from "svelte";
  import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
  import { EditorState } from "@codemirror/state";
  import {
    drawSelection,
    dropCursor,
    EditorView,
    highlightSpecialChars,
    keymap,
    placeholder
  } from "@codemirror/view";
  import { markdownKeymap } from "@codemirror/lang-markdown";
  import { appStore } from "$lib/app/appStore.svelte.js";
  import ContextMenu from "$lib/shared/components/ContextMenu.svelte";
  import { captureCodeMirrorText } from "$lib/shared/editor/noteEditorContext.js";
  import { noteEditorTheme } from "$lib/shared/editor/noteEditorTheme.js";
  import {
    createNoteMarkdownExtension,
    externalDocumentAnnotation,
    externalDocumentUpdate,
    noteLivePreview
  } from "$lib/shared/editor/noteLivePreview.js";
  import { buildEditableTextMenuItems } from "$lib/shared/services/editableTextMenuItems.js";

  let { value = "", onChange, label = "Notes" } = $props();

  let editorHost = $state(null);
  let editorView = $state(null);
  let showHelp = $state(false);
  let contextMenu = $state(null);

  let contextMenuItems = $derived.by(() => {
    return buildEditableTextMenuItems(contextMenu?.editable, {
      beforeAction: closeContextMenu,
      onError: (error) => appStore.showStatus(`Clipboard failed: ${error}`),
      includeSelectAll: false,
      trailingSeparator: false
    });
  });

  $effect(() => {
    const editor = editorView;
    const incoming = value;
    if (!editor) return;

    const update = externalDocumentUpdate(editor.state, incoming);
    if (update) editor.dispatch(update);
  });

  onMount(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        createNoteMarkdownExtension(),
        history(),
        drawSelection(),
        dropCursor(),
        highlightSpecialChars(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...markdownKeymap, indentWithTab]),
        placeholder("Click to add notes..."),
        noteLivePreview,
        noteEditorTheme,
        EditorView.contentAttributes.of({
          "aria-label": label,
          "aria-multiline": "true",
          spellcheck: "true"
        }),
        EditorView.domEventHandlers({
          contextmenu(event, editor) {
            openContextMenu(event, editor);
            return true;
          }
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (update.transactions.some((transaction) => transaction.annotation(externalDocumentAnnotation))) return;
          const nextValue = update.state.doc.toString();
          onChange(nextValue);
          revealBottomGap(update.view);
        })
      ]
    });

    editorView = new EditorView({ state, parent: editorHost });

    return () => {
      editorView?.destroy();
      editorView = null;
    };
  });

  function revealBottomGap(editor) {
    requestAnimationFrame(() => {
      if (!editor.hasFocus || editor.state.selection.main.head !== editor.state.doc.length) return;
      const scrollPanel = editor.dom.closest(".panel-scroll");
      if (!scrollPanel) return;
      const gap = parseFloat(getComputedStyle(scrollPanel).getPropertyValue("--panel-bottom-gap")) || 22;
      const missing = editor.dom.getBoundingClientRect().bottom + gap - scrollPanel.getBoundingClientRect().bottom;
      if (missing > 0) scrollPanel.scrollTop += missing;
    });
  }

  function openContextMenu(event, editor) {
    event.preventDefault();
    contextMenu = {
      x: event.clientX,
      y: event.clientY,
      editable: captureCodeMirrorText(editor)
    };
  }

  function closeContextMenu() {
    contextMenu = null;
  }
</script>

<div class="notes-container">
  <header class="notes-header">
    <span class="notes-label">{label}</span>
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
          <div class="help-note">Formatting marks appear when you edit their text.</div>
        </div>
      {/if}
    </div>
  </header>

  <div class="notes-surface" bind:this={editorHost}></div>

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
  .notes-label {
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
  .help-note {
    padding-top: 8px;
    border-top: 1px solid #2d2d2d;
    color: var(--text-muted);
    font-weight: 500;
    line-height: 1.4;
  }
  .notes-surface {
    width: 100%;
    min-height: 150px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-dark);
    color: var(--text-color);
    box-sizing: border-box;
    cursor: text;
    transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
  }
  .notes-surface:hover {
    border-color: var(--border-strong);
    background: rgba(255, 255, 255, 0.01);
  }
  .notes-surface:has(:global(.cm-focused)) {
    border-color: var(--border-strong);
    box-shadow: 0 0 0 1px var(--border-subtle);
  }
</style>
