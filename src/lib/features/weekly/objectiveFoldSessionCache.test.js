// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  ObjectiveFoldSessionCache,
  objectiveStructureFingerprint
} from "./objectiveFoldSessionCache.js";

function objectives(idPrefix = "A", contentLabel = idPrefix) {
  return [
    { id: `${idPrefix}-parent`, subjects: ["general"], status: "open", description: `${contentLabel} parent`, indent: 0 },
    { id: `${idPrefix}-child`, subjects: ["general"], status: "open", description: `${contentLabel} child`, indent: 1 },
    { id: `${idPrefix}-sibling`, subjects: ["general"], status: "open", description: `${contentLabel} sibling`, indent: 0 }
  ];
}

describe("objective fold session cache", () => {
  it("restores folded positions when reparsed objective IDs change", () => {
    const cache = new ObjectiveFoldSessionCache();
    cache.save("A.md", objectives("old", "A"), ["old-parent"]);

    expect(cache.restore("A.md", objectives("new", "A"))).toEqual(["new-parent"]);
  });

  it("invalidates a cached week when objective structure changes", () => {
    const cache = new ObjectiveFoldSessionCache();
    const original = objectives();
    cache.save("A.md", original, ["A-parent"]);

    const changed = objectives();
    changed[0] = { ...changed[0], description: "Externally changed" };

    expect(cache.restore("A.md", changed)).toEqual([]);
    expect(cache.has("A.md")).toBe(false);
  });

  it("stores only valid folds and removes fully expanded weeks", () => {
    const cache = new ObjectiveFoldSessionCache();
    const rows = objectives();

    cache.save("A.md", rows, ["A-child", "missing"]);
    expect(cache.has("A.md")).toBe(false);

    cache.save("A.md", rows, ["A-parent"]);
    expect(cache.has("A.md")).toBe(true);
    cache.save("A.md", rows, []);
    expect(cache.has("A.md")).toBe(false);
  });

  it("promotes restored entries and evicts the least recently used week", () => {
    const cache = new ObjectiveFoldSessionCache(2);
    cache.save("A.md", objectives("A"), ["A-parent"]);
    cache.save("B.md", objectives("B"), ["B-parent"]);
    expect(cache.restore("A.md", objectives("A"))).toEqual(["A-parent"]);

    cache.save("C.md", objectives("C"), ["C-parent"]);

    expect(cache.has("A.md")).toBe(true);
    expect(cache.has("B.md")).toBe(false);
    expect(cache.has("C.md")).toBe(true);
  });

  it("uses the agreed default limit of 256 folded weeks", () => {
    const cache = new ObjectiveFoldSessionCache();
    for (let index = 0; index <= 256; index += 1) {
      const label = `week-${index}`;
      cache.save(`${label}.md`, objectives(label), [`${label}-parent`]);
    }

    expect(cache.size).toBe(256);
    expect(cache.has("week-0.md")).toBe(false);
    expect(cache.has("week-1.md")).toBe(true);
  });

  it("fingerprints persisted objective structure rather than transient IDs", () => {
    expect(objectiveStructureFingerprint(objectives("old", "A"))).toBe(
      objectiveStructureFingerprint(objectives("new", "A"))
    );

    const changed = objectives("new");
    changed[1] = { ...changed[1], indent: 2 };
    expect(objectiveStructureFingerprint(changed)).not.toBe(
      objectiveStructureFingerprint(objectives("old", "A"))
    );
  });
});
