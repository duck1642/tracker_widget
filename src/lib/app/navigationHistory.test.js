import { describe, expect, it } from "vitest";
import { NavigationHistory } from "./navigationHistory.svelte.js";

const todo = { view: "todo", path: "" };
const week = { view: "week", path: "2026w30/index.md" };
const day = { view: "day", path: "2026w30/2026-07-25.md" };

describe("NavigationHistory", () => {
  it("moves backward and forward through exact destinations", () => {
    const history = new NavigationHistory(todo);
    history.visit(week);
    history.visit(day);

    expect(history.canGoBack).toBe(true);
    expect(history.canGoForward).toBe(false);
    expect(history.back()).toEqual(week);
    expect(history.back()).toEqual(todo);
    expect(history.back()).toBeNull();
    expect(history.forward()).toEqual(week);
    expect(history.forward()).toEqual(day);
    expect(history.forward()).toBeNull();
  });

  it("does not duplicate the current destination and truncates forward history", () => {
    const history = new NavigationHistory(todo);
    history.visit(week);
    history.visit(day);
    history.back();

    expect(history.visit({ ...week })).toBe(false);
    history.visit({ view: "day", path: "2026w30/2026-07-26.md" });

    expect(history.canGoForward).toBe(false);
    expect(history.entries).toEqual([
      todo,
      week,
      { view: "day", path: "2026w30/2026-07-26.md" }
    ]);
  });

  it("keeps only the newest bounded session entries", () => {
    const history = new NavigationHistory(todo, { limit: 3 });
    history.visit(week);
    history.visit(day);
    history.visit({ view: "day", path: "2026w31/2026-07-27.md" });

    expect(history.entries).toEqual([
      week,
      day,
      { view: "day", path: "2026w31/2026-07-27.md" }
    ]);
    expect(history.index).toBe(2);
  });

  it("starts fresh for every application session", () => {
    const first = new NavigationHistory(todo);
    first.visit(week);

    const restarted = new NavigationHistory(todo);
    expect(restarted.entries).toEqual([todo]);
    expect(restarted.canGoBack).toBe(false);
  });

  it("removes destinations belonging to a recycled week and keeps a valid current entry", () => {
    const history = new NavigationHistory(todo);
    history.visit(week);
    history.visit(day);
    history.visit({ view: "week", path: "2026w31/index.md" });
    history.back();

    history.removePathsUnder("2026w30");

    expect(history.entries).toEqual([
      todo,
      { view: "week", path: "2026w31/index.md" }
    ]);
    expect(history.entries[history.index]).toEqual(todo);
  });
});
