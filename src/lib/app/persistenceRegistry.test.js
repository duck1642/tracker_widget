import { describe, expect, it, vi } from "vitest";
import { PersistenceRegistry } from "./persistenceRegistry.js";

describe("PersistenceRegistry", () => {
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
});
