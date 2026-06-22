// @vitest-environment jsdom
// @ts-nocheck
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import MainTabs from "./MainTabs.svelte";
import AppSidebar from "./AppSidebar.svelte";
import FileTree from "$lib/shared/components/FileTree.svelte";
import ActivityRow from "$lib/features/daily/components/ActivityRow.svelte";
import PlanSection from "$lib/features/weekly/components/PlanSection.svelte";
import ObjectiveRow from "$lib/features/weekly/components/ObjectiveRow.svelte";
import { workspaceStore } from "./workspaceStore.svelte.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  workspaceStore.unavailable = false;
  workspaceStore.weeks = [];
});

describe("application navigation", () => {
  it("changes the main view from the tab bar", async () => {
    const onSelect = vi.fn();
    render(MainTabs, { currentView: "tasks", onSelect });
    await fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(onSelect).toHaveBeenCalledWith("day");
  });

  it("opens weekly and daily files from the file tree", async () => {
    const week = { path: "week", name: "2026w26", indexPath: "week/index.md", days: [{ path: "week/day.md", date: "2026-06-22" }] };
    const onSelectWeek = vi.fn();
    const onSelectDay = vi.fn();
    render(FileTree, { weeks: [week], selectedPath: "", onSelectWeek, onSelectDay });
    await fireEvent.click(screen.getByRole("button", { name: /Weekly index/ }));
    await fireEvent.click(screen.getByRole("button", { name: /2026-06-22/ }));
    expect(onSelectWeek).toHaveBeenCalledWith(week);
    expect(onSelectDay).toHaveBeenCalledWith(week.days[0], week);
  });
});

describe("logger editing", () => {
  it("emits Daily activity edits", async () => {
    const onUpdate = vi.fn();
    render(ActivityRow, { activity: { subjects: ["rust"], minutes: 20, description: "Old" }, onUpdate, onDelete: vi.fn() });
    await fireEvent.input(screen.getByLabelText("Minutes"), { target: { value: "45" } });
    await fireEvent.input(screen.getByLabelText("Description"), { target: { value: "New description" } });
    expect(onUpdate).toHaveBeenCalledWith({ minutes: 45 });
    expect(onUpdate).toHaveBeenCalledWith({ description: "New description" });
  });

  it("emits Weekly plan edits", async () => {
    const onUpdate = vi.fn();
    render(PlanSection, {
      plan: [{ id: "plan-1", day: "Mon", session: "Development", subjects: ["rust"], targetMinutes: 60 }],
      onAdd: vi.fn(), onUpdate, onDelete: vi.fn()
    });
    await fireEvent.input(screen.getByLabelText("Session"), { target: { value: "Review" } });
    expect(onUpdate).toHaveBeenCalledWith("plan-1", { session: "Review" });
  });

  it("emits objective origin and status independently", async () => {
    const onUpdate = vi.fn();
    render(ObjectiveRow, {
      objective: { subjects: ["rust"], origin: "planned", status: "open", description: "Ship" },
      onUpdate, onDelete: vi.fn()
    });
    await fireEvent.change(screen.getByLabelText("Origin"), { target: { value: "unplanned" } });
    await fireEvent.change(screen.getByLabelText("Status"), { target: { value: "partial" } });
    expect(onUpdate).toHaveBeenCalledWith({ origin: "unplanned" });
    expect(onUpdate).toHaveBeenCalledWith({ status: "partial" });
  });
});

describe("task actions", () => {
  it("emits row deletion for the selected task index", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: (text) => ({ width: text.length * 7 })
    });
    const { default: TaskRow } = await import("$lib/features/tasks/components/TaskRow.svelte");
    const onDeleteTask = vi.fn();
    render(TaskRow, {
      task: { id: "task-1", text: "Delete me", checked: false, indent: 0 },
      index: 2,
      inputElements: {},
      onToggleTask: vi.fn(), onUpdateText: vi.fn(), onMoveTaskUp: vi.fn(), onMoveTaskDown: vi.fn(),
      onDeleteTask, onFocus: vi.fn(), onBlur: vi.fn(), onKeyDown: vi.fn()
    });
    await fireEvent.click(screen.getByTitle("Delete"));
    expect(onDeleteTask).toHaveBeenCalledWith(2);
  });
});

describe("unavailable logs folder", () => {
  it("offers locate, select, and retry actions", async () => {
    workspaceStore.unavailable = true;
    const chooseRoot = vi.spyOn(workspaceStore, "chooseRoot").mockResolvedValue(true);
    const refresh = vi.spyOn(workspaceStore, "refresh").mockResolvedValue(true);
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn(), onClose: vi.fn() });
    const recovery = screen.getByText("Logs folder unavailable").parentElement;
    await fireEvent.click(within(recovery).getByRole("button", { name: "Locate existing" }));
    await fireEvent.click(within(recovery).getByRole("button", { name: "Select new" }));
    await fireEvent.click(within(recovery).getByRole("button", { name: "Retry" }));
    expect(chooseRoot).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe("sidebar sorting", () => {
  it("toggles between newest-first and oldest-first", async () => {
    workspaceStore.weeks = [
      { path: "new", name: "2026w25", indexPath: null, days: [] },
      { path: "old", name: "2025w52", indexPath: null, days: [] }
    ];
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });
    const labels = () => screen.getAllByRole("button", { name: /20\d\dw\d\d/ }).map((button) => button.textContent.trim());
    expect(labels()).toEqual(["2026w25", "2025w52"]);
    await fireEvent.click(screen.getByRole("button", { name: "Toggle week sorting" }));
    expect(labels()).toEqual(["2025w52", "2026w25"]);
  });
});
