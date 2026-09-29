// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersistenceCoordinator } from "./persistenceCoordinator.js";

function harness() {
  let disk = "initial";
  const fileService = {
    readFile: vi.fn(async () => disk),
    writeFile: vi.fn(async (_path, content) => { disk = content; })
  };
  const onStatus = vi.fn();
  const coordinator = new PersistenceCoordinator({ fileService, onStatus });
  coordinator.reset("note.md", disk);
  return { coordinator, fileService, onStatus, diskContent: () => disk };
}

describe("PersistenceCoordinator save safety", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(["readFile", "writeFile"])("retains edits after persistent %s failure and retries safely", async (operation) => {
    const { coordinator, fileService, onStatus, diskContent } = harness();
    const original = fileService[operation].getMockImplementation();
    fileService[operation].mockRejectedValue(new Error("unavailable"));
    await coordinator.schedule("local");

    await expect(coordinator.flush()).resolves.toBe(false);
    await expect(coordinator.flush()).resolves.toBe(false);
    expect(coordinator.state()).toMatchObject({ dirty: true, saving: false });
    expect(diskContent()).toBe("initial");
    expect(onStatus).toHaveBeenCalledWith("Save failed: Error: unavailable");

    fileService[operation].mockImplementation(original);
    expect(await coordinator.flush()).toBe(true);
    expect(diskContent()).toBe("local");
    expect(coordinator.state()).toMatchObject({ dirty: false, saving: false });
  });

  it("handles a debounced read failure without losing the edit", async () => {
    const { coordinator, fileService, diskContent } = harness();
    fileService.readFile.mockRejectedValueOnce(new Error("locked"));
    await coordinator.schedule("local");

    await vi.advanceTimersByTimeAsync(250);

    expect(coordinator.state()).toMatchObject({ dirty: true, saving: false });
    expect(fileService.writeFile).not.toHaveBeenCalled();
    expect(await coordinator.flush()).toBe(true);
    expect(diskContent()).toBe("local");
  });

  it.each(["readFile", "writeFile"])("preserves edits queued during a failing %s", async (operation) => {
    const { coordinator, fileService, diskContent } = harness();
    let rejectOperation;
    const failedOperation = new Promise((_resolve, reject) => { rejectOperation = reject; });
    fileService[operation].mockReturnValueOnce(failedOperation);
    const saving = coordinator.schedule("older", true);
    // Allow the pre-save read to complete when testing a delayed write.
    await Promise.resolve();
    expect(fileService[operation]).toHaveBeenCalled();
    await coordinator.schedule("newest");
    rejectOperation(new Error("locked"));

    await expect(saving).resolves.toBe(false);
    expect(coordinator.state().dirty).toBe(true);
    expect(await coordinator.flush()).toBe(true);
    expect(diskContent()).toBe("newest");
    expect(fileService.writeFile).toHaveBeenLastCalledWith("note.md", "newest");
  });

  it.each([false, true])("keeps the newest edit when conflict detection races with typing (newer edit: %s)", async (queueNewer) => {
    const { coordinator, fileService, diskContent } = harness();
    let finishRead;
    fileService.readFile.mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }));
    const saving = coordinator.schedule("older", true);
    if (queueNewer) await coordinator.schedule("newest");
    finishRead("external");

    expect(await saving).toBe(false);
    const expected = queueNewer ? "newest" : "older";
    expect(coordinator.state().conflict).toEqual({ path: "note.md", diskContent: "external", localContent: expected });
    expect(await coordinator.flush()).toBe(false);
    expect(fileService.writeFile).not.toHaveBeenCalled();

    fileService.readFile.mockResolvedValue("external");
    await coordinator.resolve("keep-local");
    expect(diskContent()).toBe(expected);
    expect(coordinator.state()).toMatchObject({ dirty: false, saving: false, conflict: null });
  });
});
