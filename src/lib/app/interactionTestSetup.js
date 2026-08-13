// @ts-nocheck
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/svelte";
import { todoFoldStore } from "$lib/features/todo/todoFolding.svelte.js";
import { todoUiState } from "$lib/features/todo/todoUiState.svelte.js";
import { todoStore } from "$lib/features/todo/todoStore.svelte.js";
import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
import { workspaceStore } from "./workspaceStore.svelte.js";
import { appStore } from "./appStore.svelte.js";
import { subjectHistoryStore } from "./subjectHistoryStore.svelte.js";
import { sessionHistoryStore } from "./sessionHistoryStore.svelte.js";
import { scratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.js";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openPath } from "@tauri-apps/plugin-opener";

export function installInteractionTestSetup() {
  beforeEach(() => {
    readText.mockReset();
    writeText.mockReset();
    openPath.mockReset();
    readText.mockResolvedValue("");
    writeText.mockResolvedValue();
    openPath.mockResolvedValue();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    workspaceStore.unavailable = false;
    workspaceStore.weeks = [];
    workspaceStore.todoExists = false;
    workspaceStore.scratchpadExists = false;
    appStore.logsRootPath = "";
    appStore.filePath = "";
    appStore.frontmatterMode = "off";
    appStore.statusMessage = "";
    appStore.currentView = "todo";
    todoStore.fileMissing = false;
    dailyStore.path = "";
    dailyStore.date = "";
    dailyStore.loaded = false;
    dailyStore.sessions = [];
    weekStore.setObjectiveFolds([]);
    weekStore.path = "";
    weekStore.loaded = false;
    weekStore.objectives = [];
    weekStore.plan = [];
    weekStore.actual = [];
    scratchpadStore.path = "";
    scratchpadStore.content = "";
    scratchpadStore.loaded = false;
    scratchpadStore.fileMissing = false;
    subjectHistoryStore.history = { subjects: {} };
    subjectHistoryStore.loaded = false;
    subjectHistoryStore.rebuilding = false;
    sessionHistoryStore.history = { sessions: {} };
    sessionHistoryStore.loaded = false;
    sessionHistoryStore.rebuilding = false;
    todoFoldStore.expandAll();
    todoFoldStore.setFoldableTodoIds([]);
    todoUiState.showTodoNumbers = false;
    todoUiState.clearSelection();
  });
}
