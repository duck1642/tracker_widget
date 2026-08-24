// @vitest-environment jsdom
// @ts-nocheck
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import WorkspacePane from "./WorkspacePane.svelte";

function createStore(overrides = {}) {
  return {
    conflict: null,
    fileMissing: false,
    loadedPath: "todo.md",
    path: "",
    loaded: false,
    todos: [],
    undoStack: [],
    redoStack: [],
    sessions: [],
    plan: [],
    flushSave: vi.fn().mockResolvedValue(true),
    checkExternalChanges: vi.fn().mockResolvedValue(false),
    resolveConflict: vi.fn().mockResolvedValue(true),
    loadFile: vi.fn().mockResolvedValue(true),
    loadPath: vi.fn().mockResolvedValue(true),
    addTodo: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    clearCompleted: vi.fn(),
    ...overrides
  };
}

function createSession(overrides = {}) {
  return {
    todoStore: createStore(),
    scratchpadStore: createStore(),
    weekStore: createStore(),
    dailyStore: createStore(),
    ...overrides
  };
}

const todoTab = { id: "todo", view: "todo", title: "Todo", path: "" };
const scratchpadTab = { id: "scratchpad", view: "scratchpad", title: "Scratchpad", path: "scratchpad.md" };

afterEach(() => cleanup());

describe("WorkspacePane persistence safety", () => {
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

  it("keeps a tab in its source pane when flushing or target opening fails", async () => {
    const todoStore = createStore({ flushSave: vi.fn().mockResolvedValue(false) });
    const rendered = render(WorkspacePane, {
      session: createSession({ todoStore }),
      initialTabs: [todoTab]
    });
    const accept = vi.fn().mockResolvedValue(true);
    await tick();

    expect(await rendered.component.transferTab("todo", accept)).toBe(false);
    expect(rendered.component.hasTab("todo")).toBe(true);
    expect(accept).not.toHaveBeenCalled();

    todoStore.flushSave.mockResolvedValue(true);
    accept.mockResolvedValue(false);
    expect(await rendered.component.transferTab("todo", accept)).toBe(false);
    expect(rendered.component.hasTab("todo")).toBe(true);
  });

  it("removes a transferred tab only after the target accepts it", async () => {
    const rendered = render(WorkspacePane, {
      session: createSession(),
      initialTabs: [todoTab]
    });
    const accept = vi.fn().mockResolvedValue(true);
    await tick();

    expect(await rendered.component.transferTab("todo", accept)).toBe(true);
    expect(accept).toHaveBeenCalledWith(todoTab);
    expect(rendered.component.hasTab("todo")).toBe(false);
  });

  it("loads the source pane's next same-type document after moving its active tab", async () => {
    const scratchpadStore = createStore();
    const first = { id: "scratchpad:first", view: "scratchpad", title: "First", path: "first.md" };
    const second = { id: "scratchpad:second", view: "scratchpad", title: "Second", path: "second.md" };
    const rendered = render(WorkspacePane, {
      session: createSession({ scratchpadStore }),
      initialTabs: [first, second]
    });
    await tick();

    expect(await rendered.component.transferTab(first.id, vi.fn().mockResolvedValue(true))).toBe(true);
    expect(scratchpadStore.loadPath).toHaveBeenCalledWith("second.md");
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

  it("does not leave a foreground tab behind when its document fails to load", async () => {
    const scratchpadStore = createStore({ loadPath: vi.fn().mockResolvedValue(false) });
    const rendered = render(WorkspacePane, {
      session: createSession({ scratchpadStore })
    });
    await tick();

    expect(await rendered.component.openScratchpad()).toBe(false);
    expect(rendered.component.hasTab("scratchpad")).toBe(false);
  });

  it("keeps every tab when any store blocks split-view separation", async () => {
    const scratchpadStore = createStore({ flushSave: vi.fn().mockResolvedValue(false) });
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
    const scratchpadStore = createStore();
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
});
