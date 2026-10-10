import type { TodoLine, TodoItem, TodoAction } from "./types.ts";
import { applyAction } from "./todoActions.ts";
import { deferred, readTextFile, requireValue } from "$lib/shared/testing/testHelpers.ts";
function task(line: TodoLine): TodoItem { if (!line.isTodo) throw new Error("Expected checklist item"); return line; }
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TodoStore } from "./todoStore.svelte.ts";
import { PersistenceRegistry } from "$lib/app/persistenceRegistry.ts";
import { clampContextMenuPosition } from "$lib/shared/services/contextMenuPosition.ts";

vi.mock("$lib/shared/services/logWorkspaceService.ts", () => ({
  selectTodoFile: vi.fn()
}));

function createHarness(initialFiles: Record<string, string> = { "A.md": "- [ ] A\n" }, debounceMs = 250) {
  const files = new Map(Object.entries(initialFiles));
  const writes: {path: string; content: string}[] = [];
  const fileService = {
    readFile: vi.fn(async (path: string) => readTextFile(files, path)),
    writeFile: vi.fn(async (path: string, content: string) => {
      writes.push({ path, content });
      files.set(path, content);
    }),
    getFileModifiedTime: vi.fn(async () => 1),
    pathExists: vi.fn(async (path: string) => files.has(path))
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

  it("keeps raw Markdown rows unchanged when checklist actions target their IDs", async () => {
    const { store, writes } = createHarness({ "A.md": "# Raw heading\n- [ ] Task\n" });
    await store.loadFile();
    const raw = requireValue(store.todos.find((line) => !line.isTodo));
    const original = { ...raw };
    store.toggleTodo(raw.id);
    store.updateText(raw.id, "Wrong text");
    store.indentTodo(raw.id);
    store.outdentTodo(raw.id);
    expect(raw).toEqual(original);
    expect(store.undoStack).toEqual([]);
    expect(store.dirty).toBe(false);
    expect(writes).toEqual([]);

    const actions: TodoAction[] = [
      { type: "toggle", id: raw.id, oldChecked: false, newChecked: true },
      { type: "edit", id: raw.id, oldText: "", newText: "Wrong text" },
      { type: "indent", id: raw.id, oldIndent: 0, newIndent: 1 },
      { type: "set_checked_many", todos: [{ id: raw.id, oldChecked: false, newChecked: true }] },
      { type: "shift_indent_many", todos: [{ id: raw.id, oldIndent: 0, newIndent: 1 }] }
    ];
    for (const action of actions) {
      expect(applyAction([{ ...original }], action, false)).toEqual([original]);
      expect(applyAction([{ ...original }], action, true)).toEqual([original]);
    }
  });

  it("preserves both versions when focus checking overlaps closing and saving", async () => {
    const { store, fileService, files, writes } = createHarness();
    await store.loadFile();
    store.updateText(store.todos[0].id, "local unsaved");
    const check = deferred<string>(), save = deferred<string>();
    fileService.readFile
      .mockImplementationOnce(() => check.promise)
      .mockImplementationOnce(() => save.promise);
    files.set("A.md", "- [ ] external\n");
    const checking = store.checkExternalChanges();
    const saving = store.flushSave();
    check.resolve(readTextFile(files, "A.md"));
    await checking;
    save.resolve(readTextFile(files, "A.md"));
    expect(await saving).toBe(false);
    expect(writes).toEqual([]);
    expect(task(store.todos[0]).text).toBe("local unsaved");
    expect(requireValue(store.conflict).diskContent).toBe("- [ ] external\n");
    await store.resolveConflict("keep-local");
    expect(files.get("A.md")).toBe("- [ ] local unsaved\n");
  });

  it("reloads an externally emptied file", async () => {
    const { store, files } = createHarness();
    await store.loadFile();
    files.set("A.md", "");
    expect(await store.checkExternalChanges()).toBe(true);
    expect(store.todos).toEqual([]);
    expect(store.dirty).toBe(false);
  });

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
    let releaseFirst: (() => void) | undefined;
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
    requireValue(releaseFirst)();
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

    expect(await store.flushSave()).toBe(false);
    expect(store.dirty).toBe(true);
    expect(task(store.todos[0]).text).toBe("retry me");
    expect(files.get("A.md")).toBe("- [ ] A\n");
    expect(await store.flushSave()).toBe(true);
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
    expect(task(store.todos[0]).text).toBe("B");
  });

  it("blocks navigation and the shutdown flush until a failed pre-save read recovers", async () => {
    const { store, fileService, files, appStore } = createHarness({
      "A.md": "- [ ] A\n",
      "B.md": "- [ ] B\n"
    });
    const registry = new PersistenceRegistry();
    registry.register(store);
    await store.loadFile();
    store.updateText(store.todos[0].id, "unsaved");
    fileService.readFile.mockRejectedValue(new Error("locked"));

    await expect(store.loadFile({ path: "B.md" })).resolves.toBe(false);
    await expect(registry.flushAll()).resolves.toBe(false);
    expect(store.loadedPath).toBe("A.md");
    expect(appStore.filePath).toBe("A.md");
    expect(task(store.todos[0]).text).toBe("unsaved");
    expect(store.dirty).toBe(true);
    expect(fileService.writeFile).not.toHaveBeenCalled();

    fileService.readFile.mockImplementation(async (path: string) => readTextFile(files, path));
    expect(await registry.flushAll()).toBe(true);
    expect(files.get("A.md")).toBe("- [ ] unsaved\n");
    expect(await store.loadFile({ path: "B.md" })).toBe(true);
    expect(task(store.todos[0]).text).toBe("B");
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
    expect(task(store.todos[0]).text).toBe("external");
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

describe("todo context menu positioning", () => {
  it("keeps the menu inside the viewport near bottom and right edges", () => {
    expect(clampContextMenuPosition({
      x: 450,
      y: 330,
      width: 168,
      height: 136,
      viewportWidth: 480,
      viewportHeight: 360
    })).toEqual({ x: 306, y: 218 });
  });
});

describe("TodoStore session history", () => {
  beforeEach(() => vi.useFakeTimers());

  it.each(["undo", "redo"] as const)("does not apply a delayed %s to a newer document", async (operation) => {
    const { store, files } = createHarness({ "A.md": "- [ ] A\n", "B.md": "- [ ] B\n" });
    await store.loadFile();
    store.toggleTodo(store.todos[0].id);
    await store.flushSave();
    if (operation === "redo") await store.undo();
    const save = deferred<boolean>();
    const saving = save.promise;
    vi.spyOn(store, "flushSave").mockReturnValueOnce(saving);
    const pending = store[operation]();
    await store.loadFile({ path: "B.md" });
    save.resolve(true);
    await pending;
    expect(store.loadedPath).toBe("B.md");
    expect(store.todos[0]).toMatchObject({ text: "B", checked: false });
    expect(files.get("B.md")).toBe("- [ ] B\n");
    expect(store.undoStack).toEqual([]);
    expect(store.redoStack).toEqual([]);
  });

  it("preserves history on reactivation and clears it on accepted external reload", async () => {
    const { store, files } = createHarness();
    await store.loadFile();
    store.toggleTodo(store.todos[0].id);
    await store.undo();
    expect(store.redoStack).toHaveLength(1);

    await store.loadFile();

    expect(store.undoStack).toHaveLength(0);
    expect(store.redoStack).toHaveLength(1);
    files.set("A.md", "- [ ] externally updated\n");
    await store.loadFile();
    expect(task(store.todos[0]).text).toBe("externally updated");
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
    expect(store.todos.map((todo) => task(todo).text)).toEqual(["B", "C", "A", "D"]);
    expect(store.undoStack.at(-1)).toMatchObject({ type: "move_to", fromIndex: 0, toIndex: 2 });

    await store.undo();
    expect(store.todos.map((todo) => task(todo).text)).toEqual(["A", "B", "C", "D"]);

    await store.redo();
    expect(store.todos.map((todo) => task(todo).text)).toEqual(["B", "C", "A", "D"]);
  });

  it("does not record no-op or out-of-range direct moves", async () => {
    const { store } = createHarness({ "A.md": "- [ ] A\n- [ ] B\n" });
    await store.loadFile();

    expect(store.moveTodoTo(0, 0)).toBe(false);
    expect(store.moveTodoTo(-1, 1)).toBe(false);
    expect(store.moveTodoTo(0, 5)).toBe(false);
    expect(store.todos.map((todo) => task(todo).text)).toEqual(["A", "B"]);
    expect(store.undoStack).toHaveLength(0);
  });

  it("deletes multiple todos by id with one undo step and ignores raw or missing ids", async () => {
    const { store } = createHarness({ "A.md": "- [ ] A\n# Notes\n- [ ] B\n- [ ] C\n" });
    await store.loadFile();
    const rawId = requireValue(store.todos.find((todo) => !todo.isTodo)).id;
    const ids = [store.todos[0].id, rawId, store.todos[2].id, "missing"];

    expect(store.deleteTodosByIds(ids)).toBe(true);
    expect(store.todos.map((todo) => todo.isTodo ? todo.text : todo.raw)).toEqual(["# Notes", "C"]);
    expect(store.undoStack.at(-1)).toMatchObject({ type: "delete_many" });

    await store.undo();
    expect(store.todos.map((todo) => todo.isTodo ? todo.text : todo.raw)).toEqual(["A", "# Notes", "B", "C"]);

    await store.redo();
    expect(store.todos.map((todo) => todo.isTodo ? todo.text : todo.raw)).toEqual(["# Notes", "C"]);
  });

  it("does not record empty bulk deletes", async () => {
    const { store } = createHarness({ "A.md": "# Notes\n" });
    await store.loadFile();

    expect(store.deleteTodosByIds(["missing", store.todos[0].id])).toBe(false);
    expect(store.undoStack).toHaveLength(0);
  });

  it("sets selected todos checked by id with mixed-state undo and redo", async () => {
    const { store } = createHarness({ "A.md": "- [ ] A\n# Notes\n- [x] B\n- [ ] C\n" });
    await store.loadFile();
    const ids = [store.todos[0].id, store.todos[1].id, store.todos[2].id, "missing"];

    expect(store.setTodosCheckedByIds(ids, true)).toBe(true);
    expect(store.todos.map((todo) => todo.isTodo ? todo.checked : undefined)).toEqual([true, undefined, true, false]);
    expect(store.undoStack.at(-1)).toMatchObject({ type: "set_checked_many" });

    await store.undo();
    expect(store.todos.map((todo) => todo.isTodo ? todo.checked : undefined)).toEqual([false, undefined, true, false]);

    await store.redo();
    expect(store.todos.map((todo) => todo.isTodo ? todo.checked : undefined)).toEqual([true, undefined, true, false]);
  });

  it("unchecks selected todos and skips no-op bulk checked updates", async () => {
    const { store } = createHarness({ "A.md": "- [x] A\n- [x] B\n" });
    await store.loadFile();
    const ids = store.todos.map((todo) => todo.id);

    expect(store.setTodosCheckedByIds(ids, false)).toBe(true);
    expect(store.todos.map((todo) => todo.isTodo ? todo.checked : undefined)).toEqual([false, false]);
    expect(store.undoStack).toHaveLength(1);

    expect(store.setTodosCheckedByIds(ids, false)).toBe(false);
    expect(store.undoStack).toHaveLength(1);
  });

  it("shifts selected todo indents by one level with mixed-state undo and redo", async () => {
    const { store } = createHarness({ "A.md": "- [ ] A\n  - [ ] B\n# Notes\n    - [ ] C\n" });
    await store.loadFile();
    const ids = [store.todos[0].id, store.todos[1].id, store.todos[2].id, store.todos[3].id, "missing"];

    expect(store.shiftTodosIndentByIds(ids, 1)).toBe(true);
    expect(store.todos.map((todo) => todo.isTodo ? todo.indent : undefined)).toEqual([1, 2, undefined, 3]);
    expect(store.undoStack.at(-1)).toMatchObject({ type: "shift_indent_many" });

    await store.undo();
    expect(store.todos.map((todo) => todo.isTodo ? todo.indent : undefined)).toEqual([0, 1, undefined, 2]);

    await store.redo();
    expect(store.todos.map((todo) => todo.isTodo ? todo.indent : undefined)).toEqual([1, 2, undefined, 3]);
  });

  it("outdents selected todos with a zero floor and skips no-op outdents", async () => {
    const { store } = createHarness({ "A.md": "- [ ] A\n  - [ ] B\n" });
    await store.loadFile();
    const ids = store.todos.map((todo) => todo.id);

    expect(store.shiftTodosIndentByIds(ids, -1)).toBe(true);
    expect(store.todos.map((todo) => todo.isTodo ? todo.indent : undefined)).toEqual([0, 0]);
    expect(store.undoStack).toHaveLength(1);

    expect(store.shiftTodosIndentByIds(ids, -1)).toBe(false);
    expect(store.undoStack).toHaveLength(1);
  });

  it("reports when clear-completed has nothing to remove", async () => {
    const { store, appStore } = createHarness({ "A.md": "- [ ] Active\n" });
    await store.loadFile();
    expect(store.clearCompleted()).toBe(false);
    expect(appStore.showStatus).toHaveBeenLastCalledWith("No completed todos to clear");
  });

  it("allows selecting a file and reloading todos from it", async () => {
    const { store, appStore } = createHarness({ "B.md": "- [ ] Select\n" });
    const { selectTodoFile } = await import("$lib/shared/services/logWorkspaceService.ts");

    // User cancels dialog
    vi.mocked(selectTodoFile).mockResolvedValueOnce(null);
    expect(await store.chooseFile()).toBe(false);

    // User selects B.md
    vi.mocked(selectTodoFile).mockResolvedValueOnce("B.md");
    expect(await store.chooseFile()).toBe(true);
    expect(store.loadedPath).toBe("B.md");
    expect(appStore.filePath).toBe("B.md");
    expect(task(store.todos[0]).text).toBe("Select");
    expect(appStore.saveConfig).toHaveBeenCalled();
  });
});
