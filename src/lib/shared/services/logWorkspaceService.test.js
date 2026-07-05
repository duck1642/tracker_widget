import { describe, expect, it } from "vitest";
import { getISOWeek, getWeekDescriptor } from "./logWorkspaceService.js";

describe("ISO week descriptors", () => {
  it("handles a week crossing month boundaries", () => {
    const descriptor = getWeekDescriptor(new Date(2026, 5, 29));
    expect(descriptor.folderName).toBe("2026w27");
    expect(descriptor.rangeLabel).toBe("June 29 - July 5");
  });

  it("uses ISO week-year at New Year", () => {
    expect(getISOWeek(new Date(2025, 11, 29))).toEqual({ year: 2026, week: 1 });
    expect(getWeekDescriptor(new Date(2025, 11, 29)).rangeLabel)
      .toBe("December 29, 2025 - January 4, 2026");
  });
});
