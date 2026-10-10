// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { ScratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.ts";
import { WeekStore } from "$lib/features/weekly/weekStore.svelte.ts";
import { DailyStore } from "$lib/features/daily/dailyStore.svelte.ts";
import { DocumentController, type DocumentState } from "$lib/shared/persistence/documentController.ts";
import type { WorkspaceSession, WorkspaceTab, SessionStore, TransferAcceptor } from "./types.ts";
import { deferred, requireValue } from "$lib/shared/testing/testHelpers.ts";
import { requireTodo } from "$lib/shared/testing/todoTestHelpers.ts";
import WorkspacePane from "./WorkspacePane.svelte";
import { TodoStore } from "$lib/features/todo/todoStore.svelte.ts";
import { appStore } from "./appStore.svelte.ts";

type StoreOverrides<S extends SessionStore> = Partial<Omit<S, "conflict" | "persistence">> & {
  conflict?: { path: string } | null;
  persistence?: Partial<Omit<S["persistence"], "state">> & { state?: () => Partial<DocumentState> };
};
const dependencies = {
  fileService: { readFile: async () => "", writeFile: async () => {}, pathExists: async () => true },
  appStore: { filePath: "todo.md", showStatus: vi.fn(), saveConfig: async () => {} },
  registry: { register: () => {} }
};
function patchStore<S extends SessionStore>(store: S, overrides: StoreOverrides<S> = {}): S {
  const { persistence, conflict, ...fields } = overrides;
  Object.assign(store, {
    flushSave: vi.fn(async () => true),
    checkExternalChanges: vi.fn(async () => false),
    resolveConflict: vi.fn(async () => true)
  }, fields);
  if (conflict !== undefined) store.conflict = conflict && { ...conflict, diskContent: "external", localContent: "local" };
  if (persistence) {
    const { path, state, ...methods } = persistence;
    Object.assign(store.persistence, methods);
    if (path !== undefined) vi.spyOn(store.persistence, "path", "get").mockReturnValue(path);
    if (state) {
      const original = store.persistence.state();
      vi.spyOn(store.persistence, "state").mockImplementation(() => ({ ...original, ...state() }));
    }
  }
  return store;
}
function createStore(overrides: StoreOverrides<TodoStore> = {}) {
  return patchStore<TodoStore>(Object.assign(new TodoStore(dependencies), { loadedPath: "todo.md", loadFile: vi.fn(async () => true) }), { ...overrides, persistence: { path: "todo.md", ...overrides.persistence } });
}
function createScratchpadStore(overrides: StoreOverrides<ScratchpadStore> = {}) {
  return patchStore(Object.assign(new ScratchpadStore(dependencies), { loadPath: vi.fn(async () => true) }), overrides);
}
function createWeekStore(overrides: StoreOverrides<WeekStore> = {}) { return patchStore(new WeekStore(dependencies), overrides); }
function createSession(overrides: Partial<WorkspaceSession> = {}): WorkspaceSession {
  return { todoStore: createStore(), scratchpadStore: createScratchpadStore(), weekStore: createWeekStore(),
    dailyStore: new DailyStore({ ...dependencies, weekStore: null, sessionHistoryStore: null }), ...overrides };
}
function createPersistence(overrides: Partial<DocumentController<string>>) {
  const controller = new DocumentController({ fileService: dependencies.fileService, prepare: (content) => content });
  const { path, ...methods } = overrides;
  Object.assign(controller, methods);
  if (path !== undefined) vi.spyOn(controller, "path", "get").mockReturnValue(path);
  return controller;
}

const todoTab: WorkspaceTab = { id: "todo", view: "todo", title: "Todo", path: "" };
const scratchpadTab: WorkspaceTab = { id: "scratchpad", view: "scratchpad", title: "Scratchpad", path: "scratchpad.md" };

afterEach(() => cleanup());

describe("WorkspacePane persistence safety", () => {
  it("reloads Todo after another pane edits it and releases ownership", async () => {
    let disk = "- [ ] original\n";
    const fileService = {
      pathExists: async () => true,
      readFile: async () => disk,
      writeFile: async (_path: string, content: string) => { disk = content; }
    };
    const config = { filePath: "todo.md", showStatus: vi.fn(), saveConfig: async () => {} };
    const leftStore = new TodoStore({ fileService, appStore: config });
    const rightStore = new TodoStore({ fileService, appStore: config });
    await leftStore.loadFile();
    const left = render(WorkspacePane, { session: createSession({ todoStore: leftStore }), initialTabs: [todoTab] });
    await tick();
    await left.component.replaceActiveTab(scratchpadTab);
    await rightStore.loadFile();
    rightStore.updateText(rightStore.todos[0].id, "updated in right pane");
    await rightStore.flushSave();

    expect(await left.component.openTodo()).toBe(true);
    expect(requireTodo(leftStore.todos[0]).text).toBe("updated in right pane");
    expect(screen.getByDisplayValue("updated in right pane")).toBeTruthy();
  });

  it("routes cached Todo activation through its safe store loader", async () => {
    const todoStore = createStore();
    const rendered = render(WorkspacePane, { session: createSession({ todoStore }), initialTabs: [scratchpadTab] });
    await tick();
    await rendered.component.openTodo({ background: true });
    await rendered.component.openTodo();
    expect(todoStore.loadFile).toHaveBeenCalledWith(expect.objectContaining({ path: expect.any(String), isCurrent: expect.any(Function) }));
  });

  it("refreshes Scratchpad when reclaiming it from another pane", async () => {
    const scratchpadStore = createScratchpadStore({ loaded: true, path: "scratchpad.md" });
    const rendered = render(WorkspacePane, { session: createSession({ scratchpadStore }), initialTabs: [todoTab] });
    await tick();
    await rendered.component.openTab(scratchpadTab);
    expect(scratchpadStore.loadPath).toHaveBeenCalledWith("scratchpad.md", expect.objectContaining({ isCurrent: expect.any(Function) }));
  });

  it.each([false, true])("reports the actual reason a tab cannot close (conflict: %s)", async (conflicted) => {
    const status = vi.spyOn(appStore, "showStatus");
    const todoStore = createStore({ conflict: conflicted ? { path: "todo.md" } : null, flushSave: vi.fn().mockResolvedValue(false) });
    const rendered = render(WorkspacePane, { session: createSession({ todoStore }), initialTabs: [todoTab] });
    await tick();
    await fireEvent.click(screen.getByRole("button", { name: "Close Todo" }));
    expect(rendered.component.hasTab("todo")).toBe(true);
    expect(status).toHaveBeenLastCalledWith(conflicted ? "Resolve file conflicts before closing the tab" : "Save failed. Retry saving before closing the tab");
    status.mockRestore();
  });
  it("shows Todo conflict recovery only while Todo is active and resolves through the injected store", async () => {
    const todoStore = createStore({ conflict: { path: "todo.md" } });
    const session = createSession({ todoStore });
    const rendered = render(WorkspacePane, {
      session,
      initialTabs: [scratchpadTab, todoTab]
    });
    await tick();

    expect(screen.queryByRole("alert")).toBeNull();
    await rendered.component.openTodo();

    expect(screen.getByRole("alert")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Reload External" }));
    await fireEvent.click(screen.getByRole("button", { name: "Keep Local" }));
    expect(todoStore.resolveConflict).toHaveBeenNthCalledWith(1, "reload");
    expect(todoStore.resolveConflict).toHaveBeenNthCalledWith(2, "keep-local");
  });

  it("allows focusing the already loaded document while it has an unresolved conflict", async () => {
    appStore.filePath = "todo.md";
    const todoStore = createStore({
      loadFile: vi.fn().mockResolvedValue(false),
      persistence: { path: "todo.md", state: () => ({ conflict: { path: "todo.md", diskContent: "external", localContent: "local" } }) }
    });
    const rendered = render(WorkspacePane, {
      session: createSession({ todoStore }),
      initialTabs: [scratchpadTab, todoTab]
    });
    await tick();

    expect(await rendered.component.openTodo()).toBe(true);
    expect(rendered.component.activeTabId()).toBe("todo");
  });

  it("checks external changes on the exact pane session", async () => {
    const leftTodoStore = createStore();
    const rightTodoStore = createStore();
    const left = render(WorkspacePane, {
      session: createSession({ todoStore: leftTodoStore }),
      initialTabs: [todoTab]
    });
    const right = render(WorkspacePane, {
      session: createSession({ todoStore: rightTodoStore }),
      initialTabs: [todoTab]
    });
    await tick();

    await right.component.checkActiveExternalChanges();

    expect(rightTodoStore.checkExternalChanges).toHaveBeenCalledOnce();
    expect(leftTodoStore.checkExternalChanges).not.toHaveBeenCalled();
    expect(left.component.activeTabId()).toBe("todo");
  });

  it("keeps a tab in its source pane when the target rejects the transfer", async () => {
    const todoStore = createStore();
    const rendered = render(WorkspacePane, {
      session: createSession({ todoStore }),
      initialTabs: [todoTab]
    });
    const accept = vi.fn().mockResolvedValue(false);
    await tick();

    expect(await rendered.component.transferTab("todo", accept)).toBe(false);
    expect(rendered.component.hasTab("todo")).toBe(true);
    expect(accept).toHaveBeenCalledOnce();
    expect(await rendered.component.transferTab("todo", accept)).toBe(false);
    expect(rendered.component.hasTab("todo")).toBe(true);
  });

  it("removes a transferred tab only after the target accepts it", async () => {
    const rendered = render(WorkspacePane, {
      session: createSession(),
      initialTabs: [todoTab]
    });
    const accept = vi.fn<TransferAcceptor>(async (_tab, _store, transfer) => { requireValue(transfer.commit)(); return true; });
    await tick();

    expect(await rendered.component.transferTab("todo", accept)).toBe(true);
    expect(accept).toHaveBeenCalledWith(todoTab, expect.anything(), expect.objectContaining({ isCurrent: expect.any(Function), commit: expect.any(Function) }));
    expect(rendered.component.hasTab("todo")).toBe(false);
  });

  it("loads the source pane's next same-type document after moving its active tab", async () => {
    const scratchpadStore = createScratchpadStore();
    const first: WorkspaceTab = { id: "scratchpad:first", view: "scratchpad", title: "First", path: "first.md" };
    const second: WorkspaceTab = { id: "scratchpad:second", view: "scratchpad", title: "Second", path: "second.md" };
    const rendered = render(WorkspacePane, {
      session: createSession({ scratchpadStore }),
      initialTabs: [first, second]
    });
    await tick();

    expect(await rendered.component.transferTab(first.id, async (_tab, _store, transfer) => { requireValue(transfer.commit)(); return true; })).toBe(true);
    expect(scratchpadStore.loadPath).toHaveBeenCalledWith("second.md", expect.objectContaining({ isCurrent: expect.any(Function) }));
    expect(rendered.component.activeTabId()).toBe(second.id);
  });

  it("keeps a conflicted tab visible when close is requested", async () => {
    const todoStore = createStore({ flushSave: vi.fn().mockResolvedValue(false) });
    const rendered = render(WorkspacePane, {
      session: createSession({ todoStore }),
      initialTabs: [todoTab]
    });
    await tick();

    await fireEvent.click(screen.getByRole("button", { name: "Close Todo" }));
    expect(rendered.component.hasTab("todo")).toBe(true);
  });

  it("does not close the currently loaded document when closing a stale background tab", async () => {
    const current: WorkspaceTab = { id: "week:current", view: "week", title: "Current", path: "current.md" };
    const stale: WorkspaceTab = { id: "week:stale", view: "week", title: "Stale", path: "stale.md" };
    const weekStore = createWeekStore({ path: "current.md", persistence: { path: "current.md" } });
    const rendered = render(WorkspacePane, {
      session: createSession({ weekStore }),
      initialTabs: [current, stale]
    });
    await tick();

    await fireEvent.contextMenu(screen.getByTitle("Open Stale"));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Close tab" }));

    expect(rendered.component.hasTab(stale.id)).toBe(false);
    expect(weekStore.flushSave).not.toHaveBeenCalled();
  });

  it("does not leave a foreground tab behind when its document fails to load", async () => {
    const scratchpadStore = createScratchpadStore({ loadPath: vi.fn().mockResolvedValue(false) });
    const rendered = render(WorkspacePane, {
      session: createSession({ scratchpadStore })
    });
    await tick();

    expect(await rendered.component.openScratchpad()).toBe(false);
    expect(rendered.component.hasTab("scratchpad")).toBe(false);
  });

  it("keeps every tab when any store blocks split-view separation", async () => {
    const scratchpadStore = createScratchpadStore({ flushSave: vi.fn().mockResolvedValue(false) });
    const rendered = render(WorkspacePane, {
      session: createSession({ scratchpadStore }),
      initialTabs: [todoTab, scratchpadTab]
    });
    await tick();

    expect(await rendered.component.releaseAllTabs()).toBeNull();
    expect(rendered.component.hasTab("todo")).toBe(true);
    expect(rendered.component.hasTab("scratchpad")).toBe(true);
  });

  it("releases every tab only after all unique stores flush successfully", async () => {
    const todoStore = createStore();
    const scratchpadStore = createScratchpadStore();
    const rendered = render(WorkspacePane, {
      session: createSession({ todoStore, scratchpadStore }),
      initialTabs: [todoTab, scratchpadTab]
    });
    await tick();

    expect(await rendered.component.releaseAllTabs()).toEqual([todoTab, scratchpadTab]);
    expect(todoStore.flushSave).toHaveBeenCalledOnce();
    expect(scratchpadStore.flushSave).toHaveBeenCalledOnce();
    expect(rendered.component.tabCount()).toBe(0);
  });

  it("ignores a delayed earlier load after a newer cross-view focus intent", async () => {
    const pendingScratchpad = deferred<boolean>();
    const scratchpadStore = createScratchpadStore({
      loadPath: vi.fn(() => pendingScratchpad.promise)
    });
    const todoStore = createStore();
    const onFocused = vi.fn();
    const rendered = render(WorkspacePane, {
      session: createSession({ scratchpadStore, todoStore }),
      initialTabs: [scratchpadTab, todoTab],
      onFocused
    });
    await tick();

    const delayed = rendered.component.openTab(scratchpadTab);
    await vi.waitFor(() => expect(scratchpadStore.loadPath).toHaveBeenCalledOnce());
    expect(await rendered.component.openTab(todoTab)).toBe(true);
    pendingScratchpad.resolve(true);

    expect(await delayed).toBe(false);
    expect(rendered.component.activeTabId()).toBe("todo");
    expect(onFocused).toHaveBeenCalledTimes(1);
    expect(onFocused).toHaveBeenLastCalledWith({ view: "todo", path: "" });
  });

  it("commits ownership transfer only after the controller accepts it", async () => {
    const sourcePersistence = createPersistence({
      path: "scratchpad.md",
      transferTo: vi.fn<DocumentController<string>["transferTo"]>(async (_target, options = {}) => { requireValue(options.commit)(); return { status: "ok" }; })
    });
    const sourceStore = createScratchpadStore({ persistence: sourcePersistence });
    const targetPersistence = createPersistence({ path: "scratchpad.md" });
    const targetStore = createScratchpadStore({ persistence: targetPersistence });
    const source = render(WorkspacePane, {
      session: createSession({ scratchpadStore: sourceStore }),
      initialTabs: [scratchpadTab]
    });
    const target = render(WorkspacePane, {
      session: createSession({ scratchpadStore: targetStore })
    });
    await tick();

    expect(await source.component.transferTab(
      scratchpadTab.id,
      (tab, store, transfer) => target.component.acceptTransfer(tab, store, transfer)
    )).toBe(true);
    expect(source.component.hasTab(scratchpadTab.id)).toBe(false);
    expect(target.component.hasTab(scratchpadTab.id)).toBe(true);
    expect(sourcePersistence.transferTo).toHaveBeenCalledWith(targetPersistence, expect.objectContaining({
      isCurrent: expect.any(Function),
      commit: expect.any(Function)
    }));
  });

  it("leaves both panes unchanged when atomic ownership transfer fails", async () => {
    const sourcePersistence = createPersistence({
      path: "scratchpad.md",
      transferTo: vi.fn().mockResolvedValue({ status: "conflict" })
    });
    const source = render(WorkspacePane, {
      session: createSession({ scratchpadStore: createScratchpadStore({ persistence: sourcePersistence }) }),
      initialTabs: [scratchpadTab]
    });
    const target = render(WorkspacePane, {
      session: createSession({ scratchpadStore: createScratchpadStore({ persistence: { path: "scratchpad.md" } }) })
    });
    await tick();

    expect(await source.component.transferTab(
      scratchpadTab.id,
      (tab, store, transfer) => target.component.acceptTransfer(tab, store, transfer)
    )).toBe(false);
    expect(source.component.hasTab(scratchpadTab.id)).toBe(true);
    expect(target.component.hasTab(scratchpadTab.id)).toBe(false);
  });

  it("waits for a pane store's derived job before releasing its tabs", async () => {
    const pendingDerived = deferred<boolean>();
    const week: WorkspaceTab = { id: "week:index.md", view: "week", title: "Week", path: "index.md" };
    const weekStore = createWeekStore({ flushSave: vi.fn(() => pendingDerived.promise) });
    const rendered = render(WorkspacePane, {
      session: createSession({ weekStore }),
      initialTabs: [week]
    });
    await tick();

    let committed = false;
    const releasing = rendered.component.releaseAllTabs({ commit: () => { committed = true; } });
    await vi.waitFor(() => expect(weekStore.flushSave).toHaveBeenCalledOnce());
    expect(rendered.component.hasTab(week.id)).toBe(true);
    expect(committed).toBe(false);
    pendingDerived.resolve(true);

    expect(await releasing).toEqual([week]);
    expect(committed).toBe(true);
    expect(rendered.component.hasTab(week.id)).toBe(false);
  });

  it("settles source and target derived jobs before transferring ownership", async () => {
    const pendingSource = deferred<boolean>();
    const pendingTarget = deferred<boolean>();
    const sourcePersistence = createPersistence({
      path: "scratchpad.md",
      transferTo: vi.fn<DocumentController<string>["transferTo"]>(async (_target, options = {}) => { requireValue(options.commit)(); return { status: "ok" }; })
    });
    const sourceStore = createScratchpadStore({
      persistence: sourcePersistence,
      flushSave: vi.fn(() => pendingSource.promise)
    });
    const targetPersistence = createPersistence({ path: "scratchpad.md" });
    const targetStore = createScratchpadStore({
      persistence: targetPersistence,
      flushSave: vi.fn(() => pendingTarget.promise)
    });
    const source = render(WorkspacePane, {
      session: createSession({ scratchpadStore: sourceStore }),
      initialTabs: [scratchpadTab]
    });
    const target = render(WorkspacePane, {
      session: createSession({ scratchpadStore: targetStore })
    });
    await tick();

    const transferring = source.component.transferTab(
      scratchpadTab.id,
      (tab, store, transfer) => target.component.acceptTransfer(tab, store, transfer)
    );
    await vi.waitFor(() => {
      expect(sourceStore.flushSave).toHaveBeenCalledOnce();
      expect(targetStore.flushSave).toHaveBeenCalledOnce();
    });
    expect(sourcePersistence.transferTo).not.toHaveBeenCalled();
    pendingSource.resolve(true);
    await Promise.resolve();
    pendingTarget.resolve(true);

    expect(await transferring).toBe(true);
    expect(sourcePersistence.transferTo).toHaveBeenCalledOnce();
    expect(source.component.hasTab(scratchpadTab.id)).toBe(false);
    expect(target.component.hasTab(scratchpadTab.id)).toBe(true);
  });
});
