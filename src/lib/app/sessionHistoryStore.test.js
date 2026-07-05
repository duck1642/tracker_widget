// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { SessionHistoryStore } from "./sessionHistoryStore.svelte.js";

describe("SessionHistoryStore", () => {
  it("sorts suggestions by actual count, planned count, recency, then name", async () => {
    const store = new SessionHistoryStore({
      sessionHistoryService: {
        readSessionHistory: vi.fn(async () => ({
          sessions: {
            alpha: { actual_count: 1, planned_count: 5, last_used: "2026-07-01T00:00:00.000Z" },
            zeta: { actual_count: 3, planned_count: 1, last_used: "2026-07-01T00:00:00.000Z" },
            beta: { actual_count: 3, planned_count: 2, last_used: "2026-07-01T00:00:00.000Z" },
            gamma: { actual_count: 1, planned_count: 5, last_used: "2026-07-02T00:00:00.000Z" }
          }
        }))
      }
    });

    await store.load("workspace");

    expect(store.suggestions).toEqual(["beta", "zeta", "gamma", "alpha"]);
  });

  it("records committed sessions and updates local history", async () => {
    const recordSessions = vi.fn(async () => ({
      sessions: {
        Work: { planned_count: 0, actual_count: 2, last_used: "now" }
      }
    }));
    const store = new SessionHistoryStore({
      sessionHistoryService: { recordSessions }
    });

    expect(await store.record(["Work", "Work", " "])).toBe(true);

    expect(recordSessions).toHaveBeenCalledWith(["Work"]);
    expect(store.suggestions).toEqual(["Work"]);
  });
});
