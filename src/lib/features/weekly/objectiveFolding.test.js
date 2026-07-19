import { describe, expect, it } from "vitest";
import { buildVisibleObjectiveRows, getFoldableObjectiveIds } from "./objectiveFolding.js";

const objectives = [
  { id: "parent", indent: 0 },
  { id: "child", indent: 1 },
  { id: "grandchild", indent: 2 },
  { id: "sibling", indent: 0 }
];

describe("objective folding", () => {
  it("marks rows followed by a deeper row as foldable", () => {
    expect([...getFoldableObjectiveIds(objectives)]).toEqual(["parent", "child"]);
  });

  it("hides descendants until the next same-or-lower indentation", () => {
    const result = buildVisibleObjectiveRows(objectives, ["parent"]);
    expect(result.rows.map(({ objective }) => objective.id)).toEqual(["parent", "sibling"]);
  });

  it("preserves a nested fold when its ancestor is expanded", () => {
    const collapsed = buildVisibleObjectiveRows(objectives, ["parent", "child"]);
    expect(collapsed.rows.map(({ objective }) => objective.id)).toEqual(["parent", "sibling"]);

    const expanded = buildVisibleObjectiveRows(objectives, collapsed.foldedIds.filter((id) => id !== "parent"));
    expect(expanded.rows.map(({ objective }) => objective.id)).toEqual(["parent", "child", "sibling"]);
    expect(expanded.rows.find(({ objective }) => objective.id === "child")?.isFolded).toBe(true);
  });
});
