// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: vi.fn(async () => true)
}));

vi.mock("$lib/features/tasks/todoStore.svelte.js", () => ({
  todoStore: {
    fileMissing: false,
    loadedPath: "",
    tasks: [],
    resetHistory: vi.fn(),
    loadFile: vi.fn(async () => true)
  }
}));

vi.mock("$lib/shared/services/fileService.js", () => ({
  readFile: vi.fn(async () => "- [ ] imported\n")
}));

vi.mock("$lib/shared/services/logWorkspaceService.js", () => ({
  todoPathForWorkspace: (root) => root ? `${root.replace(/[\\/]$/, "")}\\todo.md` : "",
  listLogTree: vi.fn(async () => []),
  pathExists: vi.fn(async () => false),
  selectLogsFolder: vi.fn(async () => "C:\\Tracker"),
  selectTodoFile: vi.fn(async () => "C:\\old.md"),
  createWorkspaceTodo: vi.fn(async (rootPath) => ({ path: `${rootPath}\\todo.md`, todoCount: 4, rawLineCount: 0, replaced: false })),
  importWorkspaceTodo: vi.fn(async (rootPath) => ({ path: `${rootPath}\\todo.md`, todoCount: 1, rawLineCount: 0, replaced: false })),
  countTodoItems: vi.fn((content) => content.includes("- [ ]") ? 1 : 0)
}));

import { appStore } from "./appStore.svelte.js";
import { workspaceStore } from "./workspaceStore.svelte.js";
import * as workspaceService from "$lib/shared/services/logWorkspaceService.js";
import { todoStore } from "$lib/features/tasks/todoStore.svelte.js";

describe("WorkspaceStore workspace status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appStore.logsRootPath = "";
    appStore.filePath = "";
    appStore.saveConfig = vi.fn(async () => {});
    appStore.showStatus = vi.fn();
    workspaceStore.weeks = [];
    workspaceStore.unavailable = false;
    workspaceStore.todoExists = false;
  });

  it("selects a workspace and derives the todo path", async () => {
    workspaceService.pathExists.mockResolvedValueOnce(true);
    await workspaceStore.chooseRoot();

    expect(appStore.logsRootPath).toBe("C:\\Tracker");
    expect(appStore.filePath).toBe("C:\\Tracker\\todo.md");
    expect(workspaceStore.todoExists).toBe(true);
    expect(todoStore.loadFile).toHaveBeenCalled();
  });

  it("treats an available workspace with no weeks and no todo as valid", async () => {
    appStore.logsRootPath = "C:\\Tracker";
    appStore.filePath = "C:\\Tracker\\todo.md";
    workspaceService.listLogTree.mockResolvedValueOnce([]);
    workspaceService.pathExists.mockResolvedValueOnce(false);

    expect(await workspaceStore.refresh()).toBe(true);
    expect(workspaceStore.unavailable).toBe(false);
    expect(workspaceStore.weekCount).toBe(0);
    expect(workspaceStore.todoExists).toBe(false);
  });

  it("marks an inaccessible workspace unavailable", async () => {
    appStore.logsRootPath = "C:\\Missing";
    workspaceService.listLogTree.mockRejectedValueOnce(new Error("missing"));

    expect(await workspaceStore.refresh()).toBe(false);
    expect(workspaceStore.unavailable).toBe(true);
    expect(workspaceStore.todoExists).toBe(false);
  });
});
