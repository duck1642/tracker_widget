// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { appStore } from "./appStore.svelte.js";
import { SubjectHistoryStore, subjectHistoryStore } from "./subjectHistoryStore.svelte.js";

describe("SubjectHistoryStore", () => {
  it("wires the shared singleton to application status notifications", () => {
    expect(subjectHistoryStore.appStore).toBe(appStore);
  });

  it("sorts suggestions by count, recency, then name", async () => {
    const store = new SubjectHistoryStore({
      subjectHistoryService: {
        readSubjectHistory: vi.fn(async () => ({
          subjects: {
            alpha: { count: 1, last_used: "2026-07-01T00:00:00.000Z" },
            zeta: { count: 3, last_used: "2026-07-01T00:00:00.000Z" },
            beta: { count: 3, last_used: "2026-07-02T00:00:00.000Z" },
            gamma: { count: 1, last_used: "2026-07-01T00:00:00.000Z" }
          }
        }))
      }
    });

    await store.load("workspace");

    expect(store.suggestions).toEqual(["beta", "zeta", "alpha", "gamma"]);
  });

  it("records committed subjects and updates local history", async () => {
    const recordSubjects = vi.fn(async () => ({
      subjects: {
        rust: { count: 2, last_used: "now" }
      }
    }));
    const store = new SubjectHistoryStore({
      subjectHistoryService: { recordSubjects }
    });

    expect(await store.record(["rust", "rust", " "])).toBe(true);

    expect(recordSubjects).toHaveBeenCalledWith(["rust"]);
    expect(store.suggestions).toEqual(["rust"]);
  });
});
