import { describe, expect, it, vi } from "vitest";
import { PersistenceRegistry } from "./persistenceRegistry.js";
import { DocumentController } from "$lib/shared/persistence/documentController.js";

describe("PersistenceRegistry", () => {
  it("distinguishes save failures from unresolved conflicts", () => {
    const registry = new PersistenceRegistry();
    const document = { persistence: { state: () => ({ conflict: null }) } };
    registry.register(document);
    expect(registry.blockedMessage("closing")).toBe("Save failed. Retry saving before closing");
    registry.register({ persistence: { state: () => ({ conflict: { path: "note.md" } }) } });
    expect(registry.blockedMessage("closing")).toBe("Resolve file conflicts before closing");
  });
  it("flushes every registered store and reports a blocked flush", async () => {
    const registry = new PersistenceRegistry();
    const first = { flushSave: vi.fn().mockResolvedValue(true) };
    const second = { flushSave: vi.fn().mockResolvedValue(false) };
    registry.register(first);
    registry.register(second);

    expect(await registry.flushAll()).toBe(false);
    expect(first.flushSave).toHaveBeenCalledOnce();
    expect(second.flushSave).toHaveBeenCalledOnce();
  });

  it("stable-drains a newer draft queued during a save", async () => {
    /** @type {() => void} */
    let releaseFirstWrite = () => {};
    /** @type {() => void} */
    let signalFirstWrite = () => {};
    /** @type {Promise<void>} */
    const firstWriteStarted = new Promise((resolve) => { signalFirstWrite = () => resolve(); });
    let disk = "base";
    const controller = new DocumentController({
      fileService: {
        pathExists: async () => true,
        readFile: async () => disk,
        writeFile: async (_path, content) => {
          if (content === "first") {
            signalFirstWrite();
            /** @type {Promise<void>} */
            const writeGate = new Promise((resolve) => { releaseFirstWrite = () => resolve(); });
            await writeGate;
          }
          disk = content;
        }
      }
    });
    await controller.open("note.md");
    controller.setDraft("first");
    const store = { persistence: controller, flushSave: () => controller.flush() };
    const registry = new PersistenceRegistry();
    registry.register(store);

    const flushing = registry.flushAll();
    await firstWriteStarted;
    controller.setDraft("second");
    releaseFirstWrite();

    expect(await flushing).toBe(true);
    expect(disk).toBe("second");
    expect(controller.state().dirty).toBe(false);
  });

  it("repeats store flushing when an Actual task changes while another store waits", async () => {
    /** @type {(value: boolean) => void} */
    let finishBlockedStore = () => {};
    let blockNextFlush = true;
    const weekStore = {
      actualTask: Promise.resolve(),
      flushSave: vi.fn().mockResolvedValue(true)
    };
    const blockedStore = {
      flushSave: vi.fn(() => {
        if (!blockNextFlush) return Promise.resolve(true);
        blockNextFlush = false;
        return new Promise((resolve) => { finishBlockedStore = resolve; });
      })
    };
    const registry = new PersistenceRegistry();
    registry.register(weekStore);
    registry.register(blockedStore);

    const flushing = registry.flushAll();
    await vi.waitFor(() => expect(blockedStore.flushSave).toHaveBeenCalledOnce());
    weekStore.actualTask = Promise.resolve();
    finishBlockedStore(true);

    expect(await flushing).toBe(true);
    expect(weekStore.flushSave).toHaveBeenCalledTimes(2);
    expect(blockedStore.flushSave).toHaveBeenCalledTimes(2);
  });
});
