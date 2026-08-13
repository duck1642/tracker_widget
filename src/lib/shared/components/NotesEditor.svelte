<script>
  // @ts-nocheck
  import { onMount } from "svelte";
  import { Code2, Eye } from "@lucide/svelte";
  import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
  import { Compartment, EditorState, Prec } from "@codemirror/state";
  import {
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
  import { completeTaskMarkerInput } from "$lib/shared/editor/noteEditorInput.js";
  import { continueNoteMarkdownList } from "$lib/shared/editor/noteMarkdownCommands.js";
  import { noteEditorFillTheme, noteEditorTheme } from "$lib/shared/editor/noteEditorTheme.js";
  import {
    createNoteFoldingExtension,
    getFoldSnapshot,
    getScratchpadFoldState,
    restoreFoldSnapshot,
    saveScratchpadFoldState
  } from "$lib/shared/editor/noteFolding.js";
  import {
    createNoteMarkdownExtension,
    externalDocumentAnnotation,
    externalDocumentUpdate,
    noteLivePreview
  } from "$lib/shared/editor/noteLivePreview.js";
  import { buildEditableTextMenuItems } from "$lib/shared/services/editableTextMenuItems.js";

  let { value = "", onChange, label = "Notes", fillHeight = false, helpPlacement = "above", folding = false, filePath = "" } = $props();

  let editorHost = $state(null);
  let editorView = $state(null);
  let showHelp = $state(false);
  let contextMenu = $state(null);
  let livePreviewEnabled = $state(true);

  const previewCompartment = new Compartment();

  const noteMarkdownKeymap = [
    {
      key: "Enter",
      run: continueNoteMarkdownList
    },
    ...markdownKeymap.filter((binding) => binding.key !== "Enter")
  ];

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
        dropCursor(),
        highlightSpecialChars(),
        Prec.high(keymap.of(noteMarkdownKeymap)),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        placeholder("Click to add notes..."),
        previewCompartment.of(noteLivePreview),
        noteEditorTheme,
        ...(folding ? createNoteFoldingExtension() : []),
        ...(fillHeight ? [noteEditorFillTheme] : []),
        EditorView.inputHandler.of(completeTaskMarkerInput),
        EditorView.contentAttributes.of({
          "aria-label": label,
          "aria-multiline": "true",
          spellcheck: "false"
        }),
        EditorView.domEventHandlers({
          contextmenu(event, editor) {
            openContextMenu(event, editor);
            return true;
          }
        }),
        EditorView.updateListener.of((update) => {
          if (folding && filePath) {
            saveScratchpadFoldState(filePath, update.state.doc.toString(), getFoldSnapshot(update.view));
          }
          if (!update.docChanged) return;
          if (update.transactions.some((transaction) => transaction.annotation(externalDocumentAnnotation))) return;
          const nextValue = update.state.doc.toString();
          onChange(nextValue);
          revealBottomGap(update.view);
        })
      ]
    });

    editorView = new EditorView({ state, parent: editorHost });

    if (folding && filePath) {
      const savedFolds = getScratchpadFoldState(filePath, value);
      if (savedFolds) {
        restoreFoldSnapshot(editorView, savedFolds);
      }
    }

    return () => {
      if (folding && filePath && editorView) {
        saveScratchpadFoldState(filePath, editorView.state.doc.toString(), getFoldSnapshot(editorView));
      }
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

  function toggleEditorView() {
    const editor = editorView;
    if (!editor) return;

    livePreviewEnabled = !livePreviewEnabled;
    editor.dispatch({
      effects: previewCompartment.reconfigure(livePreviewEnabled ? noteLivePreview : [])
    });
    editor.focus();
  }
</script>

<div class="notes-container" class:fill-height={fillHeight}>
  <header class="notes-header">
    <span class="notes-label">{label}</span>
    <div class="notes-actions">
      <button
        class="view-btn"
        type="button"
        onclick={toggleEditorView}
        aria-label={livePreviewEnabled ? "Show Markdown source" : "Show live preview"}
        title={livePreviewEnabled ? "Show Markdown source" : "Show live preview"}
      >
        {#if livePreviewEnabled}<Code2 size={12} />{:else}<Eye size={12} />{/if}
      </button>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class:help-below={helpPlacement === "below"} class="help-container" onmouseenter={() => showHelp = true} onmouseleave={() => showHelp = false}>
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
    </div>
  </header>

  <div class="notes-surface" class:source-view={!livePreviewEnabled} bind:this={editorHost}></div>

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
  .notes-container.fill-height {
    height: 100%;
    min-height: 0;
    grid-template-rows: auto minmax(0, 1fr);
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
  .notes-actions {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .help-container {
    position: relative;
    display: flex;
    align-items: center;
  }
  .help-btn,
  .view-btn {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: 1px solid var(--border-color);
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
  }
  .help-btn {
    border-radius: 50%;
  }
  .view-btn {
    border-radius: 4px;
  }
  .help-btn:hover,
  .view-btn:hover {
    border-color: var(--text-muted);
    color: var(--text-color);
    background: var(--surface-hover);
  }
  .help-btn:focus-visible,
  .view-btn:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: 2px;
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
  .help-container.help-below .help-popover {
    top: calc(100% + 6px);
    bottom: auto;
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
  .fill-height .notes-surface {
    height: 100%;
    min-height: 0;
  }
  .notes-surface:hover {
    border-color: var(--border-strong);
    background: var(--bg-dark);
  }
  .notes-surface:has(:global(.cm-focused)) {
    border-color: var(--border-strong);
    box-shadow: 0 0 0 1px var(--border-subtle);
  }
  .notes-surface.source-view :global(.cm-scroller) {
    font-family: var(--font-mono);
  }
</style>
