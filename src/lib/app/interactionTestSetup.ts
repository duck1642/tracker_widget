import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/svelte";
import { todoFoldStore } from "$lib/features/todo/todoFolding.svelte.ts";
import { todoUiState } from "$lib/features/todo/todoUiState.svelte.ts";
import { todoStore } from "$lib/features/todo/todoStore.svelte.ts";
import { dailyStore } from "$lib/features/daily/dailyStore.svelte.ts";
import { weekStore } from "$lib/features/weekly/weekStore.svelte.ts";
import { workspaceStore } from "./workspaceStore.svelte.ts";
import { appStore } from "./appStore.svelte.ts";
import { subjectHistoryStore } from "./subjectHistoryStore.svelte.ts";
import { sessionHistoryStore } from "./sessionHistoryStore.svelte.ts";
import { scratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.ts";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openPath } from "@tauri-apps/plugin-opener";

export function installInteractionTestSetup() {
  beforeEach(() => {
    vi.mocked(readText).mockReset();
    vi.mocked(writeText).mockReset();
    vi.mocked(openPath).mockReset();
    vi.mocked(readText).mockResolvedValue("");
    vi.mocked(writeText).mockResolvedValue(undefined);
    vi.mocked(openPath).mockResolvedValue(undefined);
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
