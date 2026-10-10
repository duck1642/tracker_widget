import { describe, expect, it, vi } from "vitest";
import { appStore } from "./appStore.svelte.ts";
import { SubjectHistoryStore, subjectHistoryStore } from "./subjectHistoryStore.svelte.ts";

describe("SubjectHistoryStore", () => {
  it("wires the shared singleton to application status notifications", () => {
    expect(subjectHistoryStore.appStore).toBe(appStore);
  });

  it("sorts suggestions by count, recency, then name", async () => {
    const store = new SubjectHistoryStore({
      subjectHistoryService: {
        rebuildSubjectHistory: vi.fn(async () => { throw new Error("Unexpected rebuild"); }),
        recordSubjects: vi.fn(async () => { throw new Error("Unexpected record"); }),
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
      subjectHistoryService: { recordSubjects, readSubjectHistory:vi.fn(async () => {throw new Error("Unexpected read");}), rebuildSubjectHistory:vi.fn(async () => {throw new Error("Unexpected rebuild");}) }
    });

    expect(await store.record(["rust", "rust", " "])).toBe(true);

    expect(recordSubjects).toHaveBeenCalledWith(["rust"]);
    expect(store.suggestions).toEqual(["rust"]);
  });
});
