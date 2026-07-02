// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TodoStore } from "./todoStore.svelte.js";

vi.mock("$lib/shared/services/logWorkspaceService.js", () => ({
  selectTodoFile: vi.fn()
}));

function createHarness(initialFiles = { "A.md": "- [ ] A\n" }, debounceMs = 250) {
  const files = new Map(Object.entries(initialFiles));
  const writes = [];
  const fileService = {
    readFile: vi.fn(async (path) => files.get(path) ?? ""),
    writeFile: vi.fn(async (path, content) => {
      writes.push({ path, content });
      files.set(path, content);
    }),
    getFileModifiedTime: vi.fn(async () => 1),
    pathExists: vi.fn(async (path) => files.has(path))
  };
  const appStore = {
    filePath: "A.md",
    showStatus: vi.fn(),
    saveConfig: vi.fn(async () => {})
  };
  return {
    store: new TodoStore({ fileService, appStore, debounceMs }),
    appStore,
    fileService,
    files,
    writes
  };
}

describe("TodoStore persistence", () => {
  beforeEach(() => vi.useFakeTimers());

  it("does not auto-select a default todo path when no path is configured", async () => {
    const { store, appStore, fileService } = createHarness();
    appStore.filePath = "";

    expect(await store.loadFile()).toBe(false);
    expect(fileService.readFile).not.toHaveBeenCalled();
    expect(appStore.filePath).toBe("");
    expect(store.fileMissing).toBe(true);
  });

  it("debounces rapid typing and writes only the newest snapshot", async () => {
    const { store, writes } = createHarness();
    await store.loadFile();

    store.updateText(store.todos[0].id, "first");
    store.updateText(store.todos[0].id, "second");
    expect(writes).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(250);
    await store.flushSave();

    expect(writes).toEqual([{ path: "A.md", content: "- [ ] second\n" }]);
    expect(store.dirty).toBe(false);
  });

  it("serializes an update arriving while a write is active", async () => {
    const { store, fileService, files, writes } = createHarness();
    await store.loadFile();
    let releaseFirst;
    fileService.writeFile.mockImplementationOnce((path, content) => new Promise((resolve) => {
      releaseFirst = () => {
        writes.push({ path, content });
        files.set(path, content);
        resolve();
      };
    }));

    store.updateText(store.todos[0].id, "first");
    const firstFlush = store.flushSave();
    await vi.waitFor(() => expect(releaseFirst).toBeTypeOf("function"));
    store.updateText(store.todos[0].id, "second");
    releaseFirst();
    await firstFlush;
    await store.flushSave();

    expect(writes.map((write) => write.content)).toEqual([
      "- [ ] first\n",
      "- [ ] second\n"
    ]);
  });

  it("retains and retries the newest snapshot after a transient write failure", async () => {
    const { store, fileService, files } = createHarness();
    await store.loadFile();
    fileService.writeFile.mockRejectedValueOnce(new Error("locked"));
    store.updateText(store.todos[0].id, "retry me");

    await store.flushSave();

    expect(files.get("A.md")).toBe("- [ ] retry me\n");
    expect(store.dirty).toBe(false);
  });

  it("flushes the old path before loading a new path", async () => {
    const { store, writes } = createHarness({
      "A.md": "- [ ] A\n",
      "B.md": "- [ ] B\n"
    });
    await store.loadFile();
    store.updateText(store.todos[0].id, "changed A");

    await store.loadFile({ path: "B.md" });

    expect(writes).toContainEqual({ path: "A.md", content: "- [ ] changed A\n" });
    expect(store.todos[0].text).toBe("B");
  });

  it("blocks an overwrite when disk content changed externally", async () => {
    const { store, files, writes } = createHarness();
    await store.loadFile();
    store.updateText(store.todos[0].id, "local");
    files.set("A.md", "- [ ] external\n");

    expect(await store.flushSave()).toBe(false);
    expect(writes).toHaveLength(0);
    expect(store.conflict).not.toBeNull();

    await store.resolveConflict("reload");
    expect(store.todos[0].text).toBe("external");
    expect(store.dirty).toBe(false);
  });

  it("overwrites external content only after keep-local is chosen", async () => {
    const { store, files } = createHarness();
    await store.loadFile();
    store.updateText(store.todos[0].id, "local");
    files.set("A.md", "- [ ] external\n");
    await store.flushSave();

    expect(await store.resolveConflict("keep-local")).toBe(true);
    expect(files.get("A.md")).toBe("- [ ] local\n");
    expect(store.conflict).toBeNull();
  });

  it("automatically reloads a clean external change", async () => {
    const { store, files } = createHarness();
    await store.loadFile();
    files.set("A.md", "- [x] external\n");

    expect(await store.checkExternalChanges()).toBe(true);
    expect(store.todos[0]).toMatchObject({ text: "external", checked: true });
  });

  it("uses clean external content as the base for the next save", async () => {
    const { store, files } = createHarness();
    await store.loadFile();
    files.set("A.md", "- [ ] external\n");
    await store.checkExternalChanges();

    store.updateText(store.todos[0].id, "local after reload");
    await store.flushSave();

    expect(store.conflict).toBeNull();
    expect(files.get("A.md")).toBe("- [ ] local after reload\n");
  });
});

describe("TodoStore session history", () => {
  beforeEach(() => vi.useFakeTimers());

  it("clears undo and redo when the document reloads", async () => {
    const { store } = createHarness();
    await store.loadFile();
    store.toggleTodo(store.todos[0].id);
    await store.undo();
    expect(store.redoStack).toHaveLength(1);

    await store.loadFile();

    expect(store.undoStack).toHaveLength(0);
    expect(store.redoStack).toHaveLength(0);
  });

  it("undoes and redoes every supported action type", async () => {
    const { store } = createHarness({ "A.md": "- [ ] A\n- [x] B\n" });
    await store.loadFile();

    const original = store.todos.map((todo) => ({ ...todo }));
    store.toggleTodo(store.todos[0].id);
    store.indentTodo(store.todos[0].id);
    store.moveTodoDown(0);
    const addedId = store.addTodo(1, 0);
    store.updateText(addedId, "new");
    store.commitTextEdit(addedId, "", "new");
    store.deleteTodo(0);
    store.clearCompleted();
    const finalState = store.todos.map((todo) => ({ ...todo }));

    while (store.undoStack.length) await store.undo();
    expect(store.todos).toEqual(original);

    while (store.redoStack.length) await store.redo();
    expect(store.todos).toEqual(finalState);
    expect(store.redoStack).toHaveLength(0);
  });

  it("moves one todo to an arbitrary index with one undo step", async () => {
    const { store } = createHarness({ "A.md": "- [ ] A\n- [ ] B\n- [ ] C\n- [ ] D\n" });
    await store.loadFile();

    expect(store.moveTodoTo(0, 2)).toBe(true);
    expect(store.todos.map((todo) => todo.text)).toEqual(["B", "C", "A", "D"]);
    expect(store.undoStack.at(-1)).toMatchObject({ type: "move_to", fromIndex: 0, toIndex: 2 });

    await store.undo();
    expect(store.todos.map((todo) => todo.text)).toEqual(["A", "B", "C", "D"]);

    await store.redo();
    expect(store.todos.map((todo) => todo.text)).toEqual(["B", "C", "A", "D"]);
  });

  it("does not record no-op or out-of-range direct moves", async () => {
    const { store } = createHarness({ "A.md": "- [ ] A\n- [ ] B\n" });
    await store.loadFile();

    expect(store.moveTodoTo(0, 0)).toBe(false);
    expect(store.moveTodoTo(-1, 1)).toBe(false);
    expect(store.moveTodoTo(0, 5)).toBe(false);
    expect(store.todos.map((todo) => todo.text)).toEqual(["A", "B"]);
    expect(store.undoStack).toHaveLength(0);
  });

  it("reports when clear-completed has nothing to remove", async () => {
    const { store, appStore } = createHarness({ "A.md": "- [ ] Active\n" });
    await store.loadFile();
    expect(store.clearCompleted()).toBe(false);
    expect(appStore.showStatus).toHaveBeenLastCalledWith("No completed todos to clear");
  });

  it("allows selecting a file and reloading todos from it", async () => {
    const { store, appStore } = createHarness({ "B.md": "- [ ] Select\n" });
    const { selectTodoFile } = await import("$lib/shared/services/logWorkspaceService.js");
    
    // User cancels dialog
    selectTodoFile.mockResolvedValueOnce(null);
    expect(await store.chooseFile()).toBe(false);
    
    // User selects B.md
    selectTodoFile.mockResolvedValueOnce("B.md");
    expect(await store.chooseFile()).toBe(true);
    expect(store.loadedPath).toBe("B.md");
    expect(appStore.filePath).toBe("B.md");
    expect(store.todos[0].text).toBe("Select");
    expect(appStore.saveConfig).toHaveBeenCalled();
  });
});
