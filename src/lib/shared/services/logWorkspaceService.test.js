import { describe, expect, it } from "vitest";
import {
  dateForISOWeek,
  getConsecutiveWeekDescriptors,
  getISOWeek,
  getWeekDescriptor,
  pathBelongsToWeek,
  scratchpadPathForWorkspace
} from "./logWorkspaceService.js";

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

  it("converts an ISO week selection to its Monday", () => {
    const date = dateForISOWeek(2026, 31);
    expect(getWeekDescriptor(date)).toMatchObject({
      year: 2026,
      week: 31,
      folderName: "2026w31",
      rangeLabel: "July 27 - August 2"
    });
  });

  it("builds consecutive week descriptors across ISO years", () => {
    expect(getConsecutiveWeekDescriptors(dateForISOWeek(2025, 52), 3)
      .map(({ folderName }) => folderName))
      .toEqual(["2025w52", "2026w01", "2026w02"]);
  });

  it("rejects invalid ISO weeks and unsafe range sizes", () => {
    expect(() => dateForISOWeek(2026, 54)).toThrow("Invalid ISO week");
    expect(() => getConsecutiveWeekDescriptors(new Date(2026, 0, 1), 0)).toThrow("between 1 and 12");
    expect(() => getConsecutiveWeekDescriptors(new Date(2026, 0, 1), 13)).toThrow("between 1 and 12");
  });

  it("matches only paths contained by the selected week folder", () => {
    expect(pathBelongsToWeek("C:\\Tracker\\2026w31\\2026w31_index.md", "c:\\tracker\\2026w31")).toBe(true);
    expect(pathBelongsToWeek("/logs/2026w31/day.md", "/logs/2026w31/")).toBe(true);
    expect(pathBelongsToWeek("/logs/2026w310/day.md", "/logs/2026w31")).toBe(false);
    expect(pathBelongsToWeek("", "/logs/2026w31")).toBe(false);
  });

  it("places the global scratchpad directly in the workspace root", () => {
    expect(scratchpadPathForWorkspace("C:\\Tracker")).toBe("C:\\Tracker\\scratchpad.md");
    expect(scratchpadPathForWorkspace("/logs/")).toBe("/logs/scratchpad.md");
    expect(scratchpadPathForWorkspace("")).toBe("");
  });
});
