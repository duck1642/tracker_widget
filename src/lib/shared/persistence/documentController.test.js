// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentController } from "./documentController.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function harness(options = {}) {
  const files = new Map(Object.entries({ "note.md": "initial", "A.md": "A", "B.md": "B", ...options.files }));
  let visible = "";
  const fileService = {
    pathExists: vi.fn(async (path) => files.has(path)),
    readFile: vi.fn(async (path) => files.get(path)),
    writeFile: vi.fn(async (path, content) => { files.set(path, content); })
  };
  const onStatus = vi.fn();
  const apply = vi.fn((content) => { visible = content; });
  const clear = vi.fn(() => { visible = ""; });
  const controller = new DocumentController({ fileService, apply, clear, onStatus, ...options });
  if (options.open !== false) await controller.open("note.md");
  return {
    controller, fileService, files, apply, clear, onStatus,
    visible: () => visible,
    edit: (content) => { visible = content; controller.setDraft(content); }
  };
}

describe("DocumentController save safety", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("keeps the latest text when an edit is reverted during a conflict", async () => {
    const { controller, edit, files } = await harness();
    edit("older edit");
    files.set("note.md", "external");
    expect((await controller.flush()).status).toBe("conflict");
    edit("initial");
    expect(controller.state()).toMatchObject({ dirty: true, conflict: { localContent: "initial" } });
    expect((await controller.resolveConflict("keep-local")).status).toBe("ok");
    expect(files.get("note.md")).toBe("initial");
    expect(controller.state()).toMatchObject({ dirty: false, conflict: null });
  });

  it("debounces typing for 250ms and saves only the latest draft", async () => {
    const { controller, edit, fileService, files } = await harness();
    edit("first");
    edit("last");
    await vi.advanceTimersByTimeAsync(249);
    expect(fileService.writeFile).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fileService.writeFile).toHaveBeenCalledExactlyOnceWith("note.md", "last");
    expect(files.get("note.md")).toBe("last");
  });

  it.each(["check-first", "save-first"])("discards external reads overlapping a save (%s)", async (order) => {
    const { controller, edit, fileService, apply } = await harness();
    const check = deferred(), save = deferred();
    fileService.readFile.mockReturnValueOnce(check.promise).mockReturnValueOnce(save.promise);
    edit("local unsaved");
    const checking = controller.checkExternal();
    const saving = controller.flush();
    if (order === "check-first") {
      check.resolve("external");
      await checking;
      save.resolve("external");
    } else {
      save.resolve("external");
      await saving;
      check.resolve("external");
    }
    expect((await checking).status).toBe("superseded");
    expect((await saving).status).toBe("conflict");
    expect(apply).toHaveBeenCalledTimes(1);
    expect(fileService.writeFile).not.toHaveBeenCalled();
    expect(controller.state().conflict).toMatchObject({ diskContent: "external", localContent: "local unsaved" });
  });

  it("ignores an external read from a previous document", async () => {
    const { controller, fileService, visible } = await harness();
    const read = deferred();
    fileService.readFile.mockReturnValueOnce(read.promise);
    const checking = controller.checkExternal();
    await controller.open("B.md");
    read.resolve("old document changed");
    expect((await checking).status).toBe("superseded");
    expect(visible()).toBe("B");
    expect(controller.baseContent).toBe("B");
  });

  it("ignores a stale check after a local edit is saved", async () => {
    const { controller, edit, fileService, files, visible } = await harness();
    const read = deferred();
    fileService.readFile.mockReturnValueOnce(read.promise);
    const checking = controller.checkExternal();
    edit("new local");
    await controller.flush();
    read.resolve("stale external");
    expect((await checking).status).toBe("superseded");
    expect(visible()).toBe("new local");
    expect(files.get("note.md")).toBe("new local");
  });

  it.each(["readFile", "writeFile"])("retains edits after %s failure and permits explicit retry", async (operation) => {
    const { controller, edit, fileService, files, onStatus } = await harness();
    const original = fileService[operation].getMockImplementation();
    fileService[operation].mockRejectedValue(new Error("unavailable"));
    edit("local");
    expect((await controller.flush()).status).toBe("error");
    expect((await controller.flush()).status).toBe("error");
    expect(controller.state()).toMatchObject({ dirty: true, saving: false, error: { operation: "save" } });
    expect(files.get("note.md")).toBe("initial");
    expect(onStatus).toHaveBeenCalledWith("Save failed: Error: unavailable");
    fileService[operation].mockImplementation(original);
    expect((await controller.flush()).status).toBe("ok");
    expect(files.get("note.md")).toBe("local");
    expect(controller.state()).toMatchObject({ dirty: false, error: null });
  });

  it("does not retry forever after a debounced failure", async () => {
    const { controller, edit, fileService } = await harness();
    fileService.readFile.mockRejectedValue(new Error("locked"));
    edit("local");
    await vi.advanceTimersByTimeAsync(250);
    const calls = fileService.readFile.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(fileService.readFile).toHaveBeenCalledTimes(calls);
    expect(controller.state().dirty).toBe(true);
    fileService.readFile.mockResolvedValue("initial");
    expect((await controller.flush()).status).toBe("ok");
  });

  it.each(["readFile", "writeFile"])("preserves edits queued during failing %s", async (operation) => {
    const { controller, edit, fileService, files } = await harness();
    const failed = deferred(), started = deferred();
    fileService[operation].mockImplementationOnce(() => { started.resolve(); return failed.promise; });
    edit("older");
    const saving = controller.flush();
    await started.promise;
    edit("newest");
    failed.reject(new Error("locked"));
    expect((await saving).status).toBe("error");
    expect(controller.state().dirty).toBe(true);
    expect((await controller.flush()).status).toBe("ok");
    expect(files.get("note.md")).toBe("newest");
  });

  it.each(["newest", "initial"])("saves the latest draft after an active write (%s)", async (latest) => {
    const { controller, edit, fileService, files } = await harness();
    const write = deferred(), started = deferred();
    fileService.writeFile.mockImplementationOnce(async (path, content) => {
      started.resolve(); await write.promise; files.set(path, content);
    });
    edit("older");
    const saving = controller.flush();
    await started.promise;
    edit(latest);
    expect(controller.state().dirty).toBe(true);
    write.resolve();
    expect((await saving).status).toBe("ok");
    expect(files.get("note.md")).toBe(latest);
    expect(fileService.writeFile.mock.calls.map((call) => call[1])).toEqual(["older", latest]);
    expect(controller.state()).toMatchObject({ dirty: false, saving: false });
  });

  it("detects conflict using the current draft after a delayed pre-save read", async () => {
    const { controller, edit, fileService, files } = await harness();
    const read = deferred();
    fileService.readFile.mockReturnValueOnce(read.promise);
    edit("older");
    const saving = controller.flush();
    edit("newest");
    files.set("note.md", "external");
    read.resolve("external");
    expect((await saving).status).toBe("conflict");
    expect(controller.state().conflict.localContent).toBe("newest");
    await controller.resolveConflict("keep-local");
    expect(files.get("note.md")).toBe("newest");
  });
});

describe("DocumentController opening", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("accepts B when A finishes later and preserves B edits", async () => {
    const { controller, fileService, edit, visible, files } = await harness();
    const readA = deferred(), started = deferred();
    const original = fileService.readFile.getMockImplementation();
    fileService.readFile.mockImplementation((path) => {
      if (path === "A.md") { started.resolve(); return readA.promise; }
      return original(path);
    });
    const openingA = controller.open("A.md");
    await started.promise;
    expect((await controller.open("B.md")).status).toBe("ok");
    edit("B edited");
    readA.resolve("A late");
    expect((await openingA).status).toBe("superseded");
    expect(controller.path).toBe("B.md");
    expect(visible()).toBe("B edited");
    await controller.flush();
    expect(files.get("B.md")).toBe("B edited");
    expect(files.get("A.md")).toBe("A");
  });

  it("flushes edits made to the old document while the target is being read", async () => {
    const { controller, fileService, edit, visible, files } = await harness();
    const target = deferred(), started = deferred();
    fileService.readFile.mockImplementationOnce(() => { started.resolve(); return target.promise; });
    const opening = controller.open("B.md");
    await started.promise;
    edit("edited while reading");
    expect(visible()).toBe("edited while reading");
    target.resolve("B");
    expect((await opening).status).toBe("ok");
    expect(files.get("note.md")).toBe("edited while reading");
    expect(visible()).toBe("B");
  });

  it("keeps the old document when the final save before transition fails", async () => {
    const { controller, fileService, edit, visible } = await harness();
    const target = deferred(), started = deferred();
    fileService.readFile.mockImplementationOnce(() => { started.resolve(); return target.promise; });
    const opening = controller.open("B.md");
    await started.promise;
    edit("unsaved edit");
    fileService.writeFile.mockRejectedValue(new Error("locked"));
    target.resolve("B");
    expect((await opening).status).toBe("error");
    expect(controller.path).toBe("note.md");
    expect(visible()).toBe("unsaved edit");
    expect(controller.state().dirty).toBe(true);
  });

  it.each(["read", "prepare"])("preserves the old document after target %s failure", async (operation) => {
    const prepare = vi.fn((content) => content);
    const { controller, fileService, visible } = await harness({ prepare });
    if (operation === "read") fileService.readFile.mockRejectedValueOnce(new Error("locked"));
    else prepare.mockImplementationOnce(() => { throw new Error("bad content"); });
    expect((await controller.open("B.md")).status).toBe("error");
    expect(controller.path).toBe("note.md");
    expect(visible()).toBe("initial");
    expect(controller.state()).toMatchObject({ loaded: true, loading: false });
  });

  it("does not report an obsolete read error over the newer document", async () => {
    const { controller, fileService, onStatus } = await harness();
    const read = deferred(), started = deferred();
    fileService.readFile.mockImplementationOnce(() => { started.resolve(); return read.promise; });
    const old = controller.open("A.md");
    await started.promise;
    await controller.open("B.md");
    read.reject(new Error("old failure"));
    expect((await old).status).toBe("superseded");
    expect(controller.state().error).toBeNull();
    expect(onStatus).not.toHaveBeenCalled();
  });

  it("preserves an unchanged draft and adapter history on same-path focus", async () => {
    const { controller, edit, visible, apply } = await harness();
    edit("local");
    expect((await controller.open("note.md")).status).toBe("unchanged");
    expect(visible()).toBe("local");
    expect(apply).toHaveBeenCalledTimes(1);
    expect(controller.state().dirty).toBe(true);
  });

  it("allows focusing the already loaded conflicted document", async () => {
    const { controller, edit, files, visible } = await harness();
    edit("local");
    files.set("note.md", "external");
    await controller.flush();
    expect((await controller.open("note.md")).status).toBe("unchanged");
    expect(visible()).toBe("local");
    expect(controller.state().conflict).not.toBeNull();
    expect((await controller.open("B.md")).status).toBe("conflict");
    expect(controller.path).toBe("note.md");
  });

  it("does not apply a prepared target after the pane cancels its request", async () => {
    const { controller, fileService, visible } = await harness();
    const read = deferred(), started = deferred();
    let current = true;
    fileService.readFile.mockImplementationOnce(() => { started.resolve(); return read.promise; });
    const opening = controller.open("B.md", { isCurrent: () => current });
    await started.promise;
    current = false;
    read.resolve("B");
    expect((await opening).status).toBe("superseded");
    expect(visible()).toBe("initial");
  });

  it("shows a missing placeholder without creating a file", async () => {
    const { controller, fileService, visible } = await harness({ open: false, missingMode: "placeholder" });
    expect((await controller.open("absent.md")).status).toBe("missing");
    expect(controller.state()).toMatchObject({ path: "absent.md", loaded: false, missing: true });
    controller.setDraft("must not create");
    await controller.flush();
    expect(visible()).toBe("");
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });
});

describe("DocumentController conflict resolution", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  async function conflicted() {
    const h = await harness();
    h.edit("local");
    h.files.set("note.md", "external");
    await h.controller.flush();
    return h;
  }

  it("automatically applies clean external content, including an empty file", async () => {
    const { controller, files, visible, apply } = await harness();
    files.set("note.md", "");
    expect(await controller.checkExternal()).toEqual({ status: "ok", applied: true });
    expect(visible()).toBe("");
    expect(apply.mock.calls.at(-1)[1].reason).toBe("external");
  });

  it("accepts disk matching the current draft without a false conflict", async () => {
    const { controller, edit, files, fileService } = await harness();
    edit("same");
    files.set("note.md", "same");
    expect((await controller.checkExternal()).status).toBe("ok");
    expect(controller.state()).toMatchObject({ dirty: false, conflict: null });
    await controller.flush();
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  it("shows a fresh conflict if disk changed again before Keep Local", async () => {
    const { controller, files, fileService } = await conflicted();
    files.set("note.md", "external again");
    expect((await controller.resolveConflict("keep-local")).status).toBe("conflict");
    expect(controller.state().conflict).toMatchObject({ diskContent: "external again", localContent: "local" });
    expect(fileService.writeFile).not.toHaveBeenCalled();
    expect((await controller.resolveConflict("keep-local")).status).toBe("ok");
    expect(files.get("note.md")).toBe("local");
  });

  it("publishes a clean state when Keep Local already matches disk", async () => {
    const onState = vi.fn();
    const { controller, edit, files, fileService } = await harness({ onState });
    edit("local");
    files.set("note.md", "external");
    await controller.flush();
    fileService.readFile.mockRejectedValueOnce(new Error("locked"));
    expect((await controller.resolveConflict("keep-local")).status).toBe("error");
    files.set("note.md", "local");
    expect((await controller.resolveConflict("keep-local")).status).toBe("unchanged");
    expect(onState.mock.calls.at(-1)[0]).toMatchObject({ dirty: false, saving: false, conflict: null, error: null });
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  it("uses edits made while Keep Local rereads the disk", async () => {
    const { controller, edit, fileService, files } = await conflicted();
    const read = deferred();
    fileService.readFile.mockReturnValueOnce(read.promise);
    const resolving = controller.resolveConflict("keep-local");
    edit("latest while resolving");
    read.resolve("external");
    expect((await resolving).status).toBe("ok");
    expect(files.get("note.md")).toBe("latest while resolving");
  });

  it("Reload External reads the latest disk, not the notification snapshot", async () => {
    const { controller, files, visible } = await conflicted();
    files.set("note.md", "latest external");
    expect((await controller.resolveConflict("reload")).status).toBe("ok");
    expect(visible()).toBe("latest external");
    expect(controller.state()).toMatchObject({ dirty: false, conflict: null });
  });

  it("does not discard typing during Reload External", async () => {
    const { controller, edit, fileService, visible } = await conflicted();
    const read = deferred();
    fileService.readFile.mockReturnValueOnce(read.promise);
    const resolving = controller.resolveConflict("reload");
    edit("typed during reload");
    read.resolve("external");
    expect((await resolving).status).toBe("superseded");
    expect(visible()).toBe("typed during reload");
    expect(controller.state().conflict.localContent).toBe("typed during reload");
  });

  it("ignores an older resolution after a newer decision", async () => {
    const { controller, fileService, files, visible } = await conflicted();
    const read = deferred();
    fileService.readFile.mockReturnValueOnce(read.promise);
    const old = controller.resolveConflict("reload");
    await controller.resolveConflict("keep-local");
    read.resolve("old external");
    expect((await old).status).toBe("superseded");
    expect(visible()).toBe("local");
    expect(files.get("note.md")).toBe("local");
  });

  it.each(["readFile", "writeFile"])("reports failed Keep Local %s and retains local text", async (operation) => {
    const { controller, fileService, visible } = await conflicted();
    fileService[operation].mockRejectedValueOnce(new Error("locked"));
    expect((await controller.resolveConflict("keep-local")).status).toBe("error");
    expect(visible()).toBe("local");
    expect(controller.state().dirty).toBe(true);
  });
});

describe("DocumentController ownership", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("invalidates a pending open before closing", async () => {
    const { controller, fileService, visible, clear } = await harness();
    const read = deferred(), started = deferred();
    fileService.readFile.mockImplementationOnce(() => { started.resolve(); return read.promise; });
    const opening = controller.open("B.md");
    await started.promise;
    expect((await controller.close()).status).toBe("ok");
    read.resolve("late B");
    expect((await opening).status).toBe("superseded");
    expect(visible()).toBe("");
    expect(clear).toHaveBeenCalledOnce();
    expect(controller.loaded).toBe(false);
  });

  it("does not partially release documents when one save fails", async () => {
    const first = await harness(), second = await harness();
    first.edit("first edit"); second.edit("second edit");
    second.fileService.writeFile.mockRejectedValue(new Error("locked"));
    const commit = vi.fn();
    expect((await DocumentController.closeAll([first.controller, second.controller], { commit })).status).toBe("error");
    expect(first.controller.loaded).toBe(true);
    expect(second.controller.loaded).toBe(true);
    expect(first.visible()).toBe("first edit");
    expect(second.visible()).toBe("second edit");
    expect(first.clear).not.toHaveBeenCalled();
    expect(second.clear).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("stable-drains edits to an earlier document while another save is pending", async () => {
    const first = await harness(), second = await harness();
    const write = deferred(), started = deferred();
    second.fileService.writeFile.mockImplementationOnce(async (path, content) => {
      started.resolve(); await write.promise; second.files.set(path, content);
    });
    first.edit("first edit"); second.edit("second edit");
    const closing = DocumentController.closeAll([first.controller, second.controller]);
    await started.promise;
    first.edit("latest first");
    write.resolve();
    expect((await closing).status).toBe("ok");
    expect(first.files.get("note.md")).toBe("latest first");
    expect(second.files.get("note.md")).toBe("second edit");
  });

  it("transfers latest source content and saves the displaced target first", async () => {
    const source = await harness(), target = await harness();
    await target.controller.open("B.md");
    source.edit("source latest"); target.edit("target latest");
    const commit = vi.fn(() => {
      expect(source.controller.loaded).toBe(false);
      expect(target.controller.path).toBe("note.md");
      expect(target.visible()).toBe("source latest");
    });
    expect((await source.controller.transferTo(target.controller, { context: { pane: "right" }, commit })).status).toBe("ok");
    expect(source.files.get("note.md")).toBe("source latest");
    expect(target.files.get("B.md")).toBe("target latest");
    expect(commit).toHaveBeenCalledOnce();
    expect(target.apply.mock.calls.at(-1)[1]).toMatchObject({ reason: "transfer", context: { pane: "right" } });
  });

  it("keeps both ownerships if the target adapter cannot prepare the transfer", async () => {
    const prepare = vi.fn((content) => content);
    const source = await harness(), target = await harness({ prepare });
    await target.controller.open("B.md");
    prepare.mockImplementationOnce(() => { throw new Error("bad content"); });
    const commit = vi.fn();
    expect((await source.controller.transferTo(target.controller, { commit })).status).toBe("error");
    expect(source.controller.path).toBe("note.md");
    expect(target.controller.path).toBe("B.md");
    expect(source.visible()).toBe("initial");
    expect(target.visible()).toBe("B");
    expect(commit).not.toHaveBeenCalled();
  });

  it("keeps both ownerships if a transfer save fails", async () => {
    const source = await harness(), target = await harness();
    await target.controller.open("B.md");
    source.edit("source edit"); target.edit("target edit");
    target.fileService.writeFile.mockRejectedValue(new Error("locked"));
    const commit = vi.fn();
    expect((await source.controller.transferTo(target.controller, { commit })).status).toBe("error");
    expect(source.controller.loaded).toBe(true);
    expect(target.controller.path).toBe("B.md");
    expect(target.visible()).toBe("target edit");
    expect(commit).not.toHaveBeenCalled();
  });

  it("does not transfer after the pane invalidates the request", async () => {
    const source = await harness(), target = await harness();
    const read = deferred(), started = deferred();
    source.fileService.readFile.mockImplementationOnce(() => { started.resolve(); return read.promise; });
    let current = true;
    const commit = vi.fn();
    const transfer = source.controller.transferTo(target.controller, { isCurrent: () => current, commit });
    await started.promise;
    current = false;
    read.resolve("initial");
    expect((await transfer).status).toBe("superseded");
    expect(source.controller.loaded).toBe(true);
    expect(target.controller.loaded).toBe(true);
    expect(commit).not.toHaveBeenCalled();
  });
});
