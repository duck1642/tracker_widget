// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: vi.fn(async () => true)
}));

vi.mock("$lib/features/todo/todoStore.svelte.js", () => ({
  todoStore: {
    fileMissing: false,
    loadedPath: "",
    todos: [],
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
  countTodoItems: vi.fn((content) => content.includes("- [ ]") ? 1 : 0),
  createWeek: vi.fn(async () => []),
  convertWeekToPersonal: vi.fn(async () => ({ converted: 0, alreadyPersonal: 0, skippedCustomFrontmatter: 0 })),
  recycleWeek: vi.fn(async () => {}),
  dateForISOWeek: vi.fn((year, week) => new Date(year, 0, week)),
  getConsecutiveWeekDescriptors: vi.fn((startDate, count) =>
    Array.from({ length: count }, (_, index) => ({
      start: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + index * 7),
      folderName: `week-${index + 1}`
    }))
  ),
  getWeekDescriptor: vi.fn((date) => {
    const start = new Date(date);
    start.setDate(start.getDate() - ((start.getDay() || 7) - 1));
    return { start };
  })
}));

import { appStore } from "./appStore.svelte.js";
import { workspaceStore } from "./workspaceStore.svelte.js";
import * as workspaceService from "$lib/shared/services/logWorkspaceService.js";
import { todoStore } from "$lib/features/todo/todoStore.svelte.js";

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

  it("creates or repairs a selected consecutive week range and refreshes once", async () => {
    appStore.logsRootPath = "C:\\Tracker";
    appStore.frontmatterMode = "personal";
    workspaceService.createWeek
      .mockResolvedValueOnce(["week-1/index.md", "week-1/day.md"])
      .mockResolvedValueOnce([]);
    vi.spyOn(workspaceStore, "refresh").mockResolvedValue(true);

    expect(await workspaceStore.createSelectedWeekFiles(2026, 31, 2)).toBe(true);

    expect(workspaceService.dateForISOWeek).toHaveBeenCalledWith(2026, 31);
    expect(workspaceService.createWeek).toHaveBeenCalledTimes(2);
    expect(workspaceService.createWeek).toHaveBeenNthCalledWith(
      1, "C:\\Tracker", expect.any(Date), "personal"
    );
    expect(workspaceService.createWeek).toHaveBeenNthCalledWith(
      2, "C:\\Tracker", expect.any(Date), "personal"
    );
    expect(workspaceStore.refresh).toHaveBeenCalledOnce();
    expect(appStore.showStatus).toHaveBeenCalledWith("Created 2 files across 2 weeks");
  });

  it("creates the next calendar week rather than the selected sidebar week", async () => {
    appStore.logsRootPath = "C:\\Tracker";
    const createWeekFiles = vi.spyOn(workspaceStore, "createWeekFiles").mockResolvedValue(true);

    await workspaceStore.createNextWeekFiles(new Date(2026, 6, 25));

    expect(createWeekFiles).toHaveBeenCalledWith(new Date(2026, 6, 27), 1);
  });

  it("checks one selected week through the existing missing-only creation path", async () => {
    appStore.logsRootPath = "C:\\Tracker";
    workspaceService.createWeek.mockResolvedValueOnce(["C:\\Tracker\\2026w31\\missing.md"]);
    vi.spyOn(workspaceStore, "refresh").mockResolvedValue(true);

    expect(await workspaceStore.repairWeek({ name: "2026w31" })).toBe(true);

    expect(workspaceService.dateForISOWeek).toHaveBeenCalledWith(2026, 31);
    expect(workspaceService.createWeek).toHaveBeenCalledWith(
      "C:\\Tracker", expect.any(Date), appStore.frontmatterMode
    );
    expect(appStore.showStatus).toHaveBeenCalledWith("Repaired 1 file in 2026w31");
  });

  it("converts a selected week and reports protected custom frontmatter", async () => {
    appStore.logsRootPath = "C:\\Tracker";
    workspaceService.convertWeekToPersonal.mockResolvedValueOnce({
      converted: 6,
      alreadyPersonal: 1,
      skippedCustomFrontmatter: 1
    });
    vi.spyOn(workspaceStore, "refresh").mockResolvedValue(true);

    expect(await workspaceStore.convertWeekToPersonal({ name: "2026w31" })).toBe(true);

    expect(workspaceService.convertWeekToPersonal).toHaveBeenCalledWith("C:\\Tracker", "2026w31");
    expect(appStore.showStatus).toHaveBeenCalledWith(
      "Converted 6 files in 2026w31; 1 already personal; 1 custom frontmatter skipped"
    );
  });

  it("recycles a selected week and refreshes the tree", async () => {
    appStore.logsRootPath = "C:\\Tracker";
    vi.spyOn(workspaceStore, "refresh").mockResolvedValue(true);

    expect(await workspaceStore.recycleWeek({ name: "2026w31" })).toBe(true);

    expect(workspaceService.recycleWeek).toHaveBeenCalledWith("C:\\Tracker", "2026w31");
    expect(workspaceStore.refresh).toHaveBeenCalledOnce();
    expect(appStore.showStatus).toHaveBeenCalledWith("Moved 2026w31 to Recycle Bin");
  });
});
