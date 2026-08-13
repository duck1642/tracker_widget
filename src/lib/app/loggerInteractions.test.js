// @vitest-environment jsdom
// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { tick } from "svelte";
import AppHeader from "./AppHeader.svelte";
import AppSidebar from "./AppSidebar.svelte";
import WorkspaceTabs from "./WorkspaceTabs.svelte";
import SettingsPanel from "./SettingsPanel.svelte";
import SettingsDialog from "./SettingsDialog.svelte";
import HelpDialog from "./HelpDialog.svelte";
import StatusToast from "./StatusToast.svelte";
import FileTree from "$lib/shared/components/FileTree.svelte";
import ContextMenu from "$lib/shared/components/ContextMenu.svelte";
import ActivityRow from "$lib/features/daily/components/ActivityRow.svelte";
import SessionCard from "$lib/features/daily/components/SessionCard.svelte";
import DailyPanel from "$lib/features/daily/components/DailyPanel.svelte";
import DailyHeader from "$lib/features/daily/components/DailyHeader.svelte";
import SubjectInput from "$lib/shared/components/SubjectInput.svelte";
import AddSessionForm from "$lib/features/daily/components/AddSessionForm.svelte";
import PlanSection from "$lib/features/weekly/components/PlanSection.svelte";
import ActualSection from "$lib/features/weekly/components/ActualSection.svelte";
import WeekPanel from "$lib/features/weekly/components/WeekPanel.svelte";
import ObjectiveRow from "$lib/features/weekly/components/ObjectiveRow.svelte";
import TodoPanel from "$lib/features/todo/components/TodoPanel.svelte";
import TodoToolbar from "$lib/features/todo/components/TodoToolbar.svelte";
import { todoFoldStore } from "$lib/features/todo/todoFolding.svelte.js";
import { todoUiState } from "$lib/features/todo/todoUiState.svelte.js";
import { todoStore } from "$lib/features/todo/todoStore.svelte.js";
import { dailyStore } from "$lib/features/daily/dailyStore.svelte.js";
import { weekStore } from "$lib/features/weekly/weekStore.svelte.js";
import { workspaceStore } from "./workspaceStore.svelte.js";
import { appStore } from "./appStore.svelte.js";
import { subjectHistoryStore } from "./subjectHistoryStore.svelte.js";
import { sessionHistoryStore } from "./sessionHistoryStore.svelte.js";
import { scratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.js";
import { formatDate, getWeekDescriptor } from "$lib/shared/services/logWorkspaceService.js";
import * as logWorkspaceService from "$lib/shared/services/logWorkspaceService.js";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openPath } from "@tauri-apps/plugin-opener";
import { EditorView } from "@codemirror/view";

import { installInteractionTestSetup } from './interactionTestSetup.js';

installInteractionTestSetup();

describe("logger editing", () => {
  it("renders and edits subjects as individual pills", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust", "programming"], onChange, variant: "badge" });

    expect(screen.getByRole("button", { name: "rust" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "programming" })).toBeTruthy();

    const addInput = screen.getByRole("textbox", { name: "Add subject" });
    await fireEvent.input(addInput, { target: { value: "testing" } });
    await fireEvent.keyDown(addInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["rust", "programming", "testing"]);

    await fireEvent.click(screen.getByRole("button", { name: "rust" }));
    const editInput = screen.getByRole("textbox", { name: "Edit subject rust" });
    await fireEvent.input(editInput, { target: { value: "backend" } });
    await fireEvent.keyDown(editInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["backend", "programming"]);
  });

  it("commits subject additions with comma and Tab", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust"], onChange, variant: "badge" });
    const addInput = screen.getByRole("textbox", { name: "Add subject" });

    await fireEvent.input(addInput, { target: { value: "cli" } });
    await fireEvent.keyDown(addInput, { key: "," });
    expect(onChange).toHaveBeenCalledWith(["rust", "cli"]);

    await fireEvent.input(addInput, { target: { value: "web" } });
    await fireEvent.keyDown(addInput, { key: "Tab" });
    expect(onChange).toHaveBeenCalledWith(["rust", "web"]);
  });

  it("rejects invalid and duplicate subject additions", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust"], onChange, variant: "badge" });
    const addInput = screen.getByRole("textbox", { name: "Add subject" });

    await fireEvent.input(addInput, { target: { value: "bad subject" } });
    await fireEvent.keyDown(addInput, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Invalid or duplicate subject")).toBeTruthy();

    await fireEvent.input(addInput, { target: { value: "RUST" } });
    await fireEvent.keyDown(addInput, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes subjects but prevents empty subject lists", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust", "test"], onChange, variant: "badge" });
    await fireEvent.click(screen.getByRole("button", { name: "Remove test" }));
    expect(onChange).toHaveBeenCalledWith(["rust"]);

    cleanup();
    const singleChange = vi.fn();
    render(SubjectInput, { subjects: ["rust"], onChange: singleChange, variant: "badge" });
    expect(screen.queryByRole("button", { name: "Remove rust" })).toBeNull();
    const addInput = screen.getByRole("textbox", { name: "Add subject" });
    await fireEvent.keyDown(addInput, { key: "Backspace" });
    expect(singleChange).not.toHaveBeenCalled();
  });

  it("removes the previous subject with Backspace on an empty add input", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust", "test"], onChange, variant: "badge" });
    const addInput = screen.getByRole("textbox", { name: "Add subject" });

    await fireEvent.keyDown(addInput, { key: "Backspace" });

    expect(onChange).toHaveBeenCalledWith(["rust"]);
  });

  it("cancels subject add and edit input with Escape", async () => {
    const onChange = vi.fn();
    const onWindowEscape = vi.fn();
    window.addEventListener("keydown", onWindowEscape);
    render(SubjectInput, { subjects: ["rust", "test"], onChange, variant: "badge" });
    const addInput = screen.getByRole("textbox", { name: "Add subject" });

    await fireEvent.input(addInput, { target: { value: "cli" } });
    await fireEvent.keyDown(addInput, { key: "Escape" });
    expect(addInput.value).toBe("");
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole("button", { name: "rust" }));
    await fireEvent.keyDown(screen.getByRole("textbox", { name: "Edit subject rust" }), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Edit subject rust" })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(onWindowEscape).not.toHaveBeenCalled();
    window.removeEventListener("keydown", onWindowEscape);
  });

  it("cancels an empty pill edit before starting a new pill", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["general"], onChange, variant: "badge" });

    await fireEvent.click(screen.getByRole("button", { name: "general" }));
    const editInput = screen.getByRole("textbox", { name: "Edit subject general" });
    await fireEvent.input(editInput, { target: { value: "" } });

    const addInput = screen.getByRole("textbox", { name: "Add subject" });
    await fireEvent.focus(addInput);
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(screen.queryByRole("textbox", { name: "Edit subject general" })).toBeNull();
    expect(screen.getByRole("button", { name: "general" })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.input(addInput, { target: { value: "programming" } });
    await fireEvent.keyDown(addInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["general", "programming"]);
  });

  it("restores an existing pill when an empty edit loses focus", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["general"], onChange, variant: "badge" });

    await fireEvent.click(screen.getByRole("button", { name: "general" }));
    const editInput = screen.getByRole("textbox", { name: "Edit subject general" });
    await fireEvent.input(editInput, { target: { value: "" } });
    await fireEvent.blur(editInput);

    expect(screen.queryByRole("textbox", { name: "Edit subject general" })).toBeNull();
    expect(screen.getByRole("button", { name: "general" })).toBeTruthy();
    expect(screen.queryByRole("listbox", { name: "Subject suggestions" })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("suggests subjects while adding and editing pills", async () => {
    subjectHistoryStore.history = {
      subjects: {
        rust: { count: 4, last_used: "2026-07-03T00:00:00.000Z" },
        backend: { count: 2, last_used: "2026-07-02T00:00:00.000Z" },
        frontend: { count: 1, last_used: "2026-07-01T00:00:00.000Z" }
      }
    };
    const record = vi.spyOn(subjectHistoryStore, "record").mockResolvedValue(true);
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust"], onChange, variant: "badge" });

    const addInput = screen.getByRole("textbox", { name: "Add subject" });
    await fireEvent.focus(addInput);
    expect(screen.queryByRole("option", { name: "rust" })).toBeNull();
    expect(screen.getByRole("option", { name: "backend" })).toBeTruthy();

    await fireEvent.input(addInput, { target: { value: "front" } });
    expect(screen.queryByRole("option", { name: "backend" })).toBeNull();
    await fireEvent.click(screen.getByRole("option", { name: "frontend" }));

    expect(onChange).toHaveBeenCalledWith(["rust", "frontend"]);
    expect(record).toHaveBeenCalledWith(["frontend"]);
  });

  it("emits Daily activity edits", async () => {
    const onUpdate = vi.fn();
    render(ActivityRow, { activity: { subjects: ["rust"], minutes: 20, description: "Old" }, onUpdate, onDelete: vi.fn() });

    // Open minutes editor by clicking the badge
    await fireEvent.click(screen.getByLabelText("Edit minutes spent"));
    await fireEvent.input(screen.getByRole("textbox", { name: "Edit minutes spent" }), { target: { value: "45" } });

    // Open description editor by clicking the description text
    await fireEvent.click(screen.getByText("Old"));
    await fireEvent.input(screen.getByPlaceholderText("What happened?"), { target: { value: "New description" } });

    expect(onUpdate).toHaveBeenCalledWith({ minutes: 45 });
    expect(onUpdate).toHaveBeenCalledWith({ description: "New description" });

    await fireEvent.input(screen.getByRole("textbox", { name: "Add subject" }), { target: { value: "daily" } });
    await fireEvent.keyDown(screen.getByRole("textbox", { name: "Add subject" }), { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith({ subjects: ["rust", "daily"] });
  });

  it("emits Daily activity move actions", async () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    render(ActivityRow, {
      activity: { subjects: ["rust"], minutes: 20, description: "Move me" },
      canMoveUp: true,
      canMoveDown: true,
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onMoveUp,
      onMoveDown
    });

    await fireEvent.click(screen.getByRole("button", { name: "Move activity up" }));
    await fireEvent.click(screen.getByRole("button", { name: "Move activity down" }));

    expect(onMoveUp).toHaveBeenCalledOnce();
    expect(onMoveDown).toHaveBeenCalledOnce();
  });

  it("renders a session drag handle and emits pointer drag callbacks", async () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const onDragOver = vi.fn();
    const onDrop = vi.fn();
    render(SessionCard, {
      session: { id: "session-1", name: "Work", activities: [] },
      dragState: null,
      onAddActivity: vi.fn(),
      onUpdateActivity: vi.fn(),
      onDeleteActivity: vi.fn(),
      onMoveActivity: vi.fn(),
      onDeleteSession: vi.fn(),
      onRenameSession: vi.fn(),
      onDragStart,
      onDragOver,
      onDragLeave: vi.fn(),
      onDrop,
      onDragEnd
    });

    const handle = screen.getByRole("button", { name: "Reorder Work" });
    await fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    await fireEvent.pointerMove(window, { pointerId: 1, clientX: 0, clientY: 12 });
    await fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 12 });

    expect(onDragStart).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }));
    expect(onDragEnd).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }));
    expect(onDragOver).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("shows suggestions when renaming a daily session", async () => {
    const onRenameSession = vi.fn(() => true);
    render(SessionCard, {
      session: { id: "session-1", name: "Work", activities: [] },
      suggestions: [
        { name: "Deep Work", plannedThisWeek: true },
        { name: "Review", plannedThisWeek: false },
        { name: "Long renamed session", plannedThisWeek: false }
      ],
      existingSessions: ["Work", "Review"],
      dragState: null,
      onAddActivity: vi.fn(),
      onUpdateActivity: vi.fn(),
      onDeleteActivity: vi.fn(),
      onMoveActivity: vi.fn(),
      onDeleteSession: vi.fn(),
      onRenameSession,
      onDragStart: vi.fn(),
      onDragOver: vi.fn(),
      onDragLeave: vi.fn(),
      onDrop: vi.fn(),
      onDragEnd: vi.fn()
    });

    await fireEvent.click(screen.getByText("Work"));

    expect(screen.getByRole("option", { name: "Deep Work" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Long renamed session" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Review" })).toBeNull();

    await fireEvent.input(screen.getByDisplayValue("Work"), { target: { value: "long" } });
    expect(screen.queryByRole("option", { name: "Deep Work" })).toBeNull();
    await fireEvent.click(screen.getByRole("option", { name: "Long renamed session" }));

    expect(onRenameSession).toHaveBeenCalledWith("Long renamed session");
  });

  it("cancels a daily session rename with Escape", async () => {
    const onRenameSession = vi.fn(() => true);
    const onWindowEscape = vi.fn();
    window.addEventListener("keydown", onWindowEscape);
    render(SessionCard, {
      session: { id: "session-1", name: "Work", activities: [] },
      dragState: null,
      onAddActivity: vi.fn(), onUpdateActivity: vi.fn(), onDeleteActivity: vi.fn(),
      onMoveActivity: vi.fn(), onDeleteSession: vi.fn(), onRenameSession,
      onDragStart: vi.fn(), onDragOver: vi.fn(), onDragLeave: vi.fn(),
      onDrop: vi.fn(), onDragEnd: vi.fn()
    });

    await fireEvent.click(screen.getByText("Work"));
    const input = screen.getByDisplayValue("Work");
    await fireEvent.input(input, { target: { value: "Draft" } });
    await fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByDisplayValue("Draft")).toBeNull();
    expect(screen.getByText("Work")).toBeTruthy();
    expect(onRenameSession).not.toHaveBeenCalled();
    expect(onWindowEscape).not.toHaveBeenCalled();
    window.removeEventListener("keydown", onWindowEscape);
  });

  it("keeps daily session and activity context menus separate", async () => {
    dailyStore.loaded = true;
    dailyStore.date = "2026-07-19";
    dailyStore.sessions = [
      { id: "s1", name: "First session", activities: [
        { id: "a1", subjects: ["rust"], minutes: 20, description: "First activity" },
        { id: "a2", subjects: ["test"], minutes: 10, description: "Second activity" }
      ] },
      { id: "s2", name: "Second session", activities: [] }
    ];
    const moveSessionTo = vi.spyOn(dailyStore, "moveSessionTo").mockReturnValue(true);
    const moveActivity = vi.spyOn(dailyStore, "moveActivity").mockReturnValue(true);
    const removeActivity = vi.spyOn(dailyStore, "removeActivity").mockImplementation(() => {});

    render(DailyPanel);
    await fireEvent.contextMenu(screen.getByText("First session").closest(".session-card"));
    expect(screen.getByRole("menu", { name: "Session actions" })).toBeTruthy();
    expect(screen.queryByRole("menu", { name: "Activity actions" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Move Up" }).disabled).toBe(true);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Move Down" }));
    expect(moveSessionTo).toHaveBeenCalledWith("s1", "s2", "after");

    await fireEvent.contextMenu(screen.getByText("First activity").closest(".activity-card"));
    expect(screen.getByRole("menu", { name: "Activity actions" })).toBeTruthy();
    expect(screen.queryByRole("menu", { name: "Session actions" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Move Up" }).disabled).toBe(true);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Move Down" }));
    expect(moveActivity).toHaveBeenCalledWith("s1", "a1", "down");

    await fireEvent.contextMenu(screen.getByText("Second activity").closest(".activity-card"));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(removeActivity).toHaveBeenCalledWith("s1", "a2");
  });

  it("adds clipboard actions to daily session and activity editors", async () => {
    dailyStore.loaded = true;
    dailyStore.date = "2026-07-19";
    dailyStore.sessions = [{ id: "s1", name: "Session name", activities: [
      { id: "a1", subjects: ["rust"], minutes: 20, description: "Activity text" }
    ] }];
    vi.spyOn(dailyStore, "save").mockResolvedValue(true);

    render(DailyPanel);
    await fireEvent.click(screen.getByText("Session name"));
    const sessionInput = screen.getByDisplayValue("Session name");
    sessionInput.setSelectionRange(0, 7);
    await fireEvent.contextMenu(sessionInput);
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });

    await fireEvent.click(screen.getByText("Activity text"));
    const activityInput = screen.getByPlaceholderText("What happened?");
    activityInput.setSelectionRange(0, 8);
    await fireEvent.contextMenu(activityInput);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Cut" }));
    await vi.waitFor(() => expect(dailyStore.sessions[0].activities[0].description).toBe(" text"));
    expect(writeText).toHaveBeenCalledWith("Activity");
  });

  it("renders a zero-minute default when TimeInput has no minutes prop", async () => {
    const { default: TimeInput } = await import("$lib/shared/components/TimeInput.svelte");
    render(TimeInput, { onChange: vi.fn(), variant: "badge" });
    expect(screen.getByRole("button", { name: "Edit minutes spent" }).textContent.trim()).toBe("0m");
  });

  it("emits Weekly plan edits", async () => {
    const onUpdate = vi.fn();
    render(PlanSection, {
      plan: [{ id: "p1", day: "Mon", session: "Development", subjects: ["stale"], targetMinutes: 99, activities: [{ id: "a1", subjects: ["rust"], minutes: 60, description: "Build" }] }],
      onAdd: vi.fn(), onUpdate, onDelete: vi.fn()
    });
    await fireEvent.click(screen.getByRole("button", { name: "Development" }));
    await fireEvent.input(screen.getByPlaceholderText("What session?"), { target: { value: "Review" } });
    expect(onUpdate).toHaveBeenCalledWith("p1", { session: "Review" });
    expect(screen.getByText("60m")).toBeTruthy();
    expect(screen.getByText("rust")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Add subject" })).toBeNull();
  });

  it("duplicates a Weekly Planned card from its context menu", async () => {
    const onDuplicate = vi.fn();
    render(PlanSection, {
      plan: [{ id: "p1", day: "Mon", session: "Development", subjects: ["rust"], targetMinutes: 60, activities: [] }],
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate
    });

    await fireEvent.contextMenu(screen.getByRole("button", { name: "Development" }).closest("article"));
    expect(screen.getByRole("menu", { name: "Planned session actions" }).style.width).toBe("112px");
    await fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    expect(onDuplicate).toHaveBeenCalledWith("p1");
    expect(screen.queryByRole("menu", { name: "Planned session actions" })).toBeNull();
  });

  it("offers standard clipboard actions in the Weekly Planned session input", async () => {
    render(PlanSection, {
      plan: [{ id: "p1", day: "Mon", session: "Development", subjects: ["rust"], targetMinutes: 60, activities: [] }],
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate: vi.fn()
    });

    await fireEvent.click(screen.getByRole("button", { name: "Development" }));
    const input = screen.getByPlaceholderText("What session?");
    input.setSelectionRange(0, 7);
    await fireEvent.contextMenu(input);

    expect(screen.getByRole("menu", { name: "Planned session text actions" }).style.width).toBe("196px");
    expect(screen.getByRole("menuitem", { name: "Cut" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Paste" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Select All" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Duplicate" })).toBeNull();

    await fireEvent.pointerDown(screen.getByRole("menuitem", { name: "Copy" }));
    expect(document.activeElement).toBe(input);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("Develop");
  });

  it("edits unknown durations without conflating them with zero", async () => {
    const onUpdate = vi.fn();
    render(ActivityRow, {
      activity: { subjects: ["general"], minutes: null, description: "Estimate later" },
      onUpdate,
      onDelete: vi.fn()
    });

    const badge = screen.getByRole("button", { name: "Edit minutes spent" });
    expect(badge.textContent.trim()).toBe("?");
    await fireEvent.click(badge);
    const input = screen.getByRole("textbox", { name: "Edit minutes spent" });
    await fireEvent.input(input, { target: { value: "?" } });
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith({ minutes: null });
  });

  it("marks existing Daily totals as incomplete when durations are unknown", () => {
    render(DailyHeader, { date: "2026-07-25", totalMinutes: 100, unknownDurationCount: 1 });
    expect(screen.getByText("1h 40m+")).toBeTruthy();
    expect(screen.getByText("100 known minutes")).toBeTruthy();
  });

  it("marks Daily session subtotals as incomplete", () => {
    render(SessionCard, {
      session: {
        id: "session",
        name: "Work",
        activities: [
          { id: "known", subjects: ["rust"], minutes: 30, description: "Known" },
          { id: "unknown", subjects: ["test"], minutes: null, description: "Unknown" }
        ]
      }
    });
    expect(screen.getByText("30m+ / 2 activities")).toBeTruthy();
  });

  it("shares collapsed days between weekly plan and actual", async () => {
    weekStore.loaded = true;
    weekStore.descriptor = { year: 2026, week: 29, rangeLabel: "Jul 13 – Jul 19" };
    weekStore.plan = [{ id: "p1", day: "Mon", session: "Plan session", activities: [] }];
    weekStore.actual = [{ day: "Mon", session: "Actual session", subjects: [], actualMinutes: 30, activities: [] }];

    const { container } = render(WeekPanel);
    const collapseMonday = screen.getAllByRole("button", { name: "Collapse Mon" });
    expect(collapseMonday).toHaveLength(2);
    await fireEvent.click(collapseMonday[0]);

    expect(screen.queryByRole("button", { name: "Plan session" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open actual activities for Actual session" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Expand Mon" })).toHaveLength(2);
    expect(container.querySelector("#plan .week-board").style.gridTemplateColumns.startsWith("56px")).toBe(true);
    expect(container.querySelector("#actual .week-board").style.gridTemplateColumns.startsWith("56px")).toBe(true);

    await fireEvent.click(screen.getAllByRole("button", { name: "Expand Mon" })[1]);
    expect(screen.getByRole("button", { name: "Plan session" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open actual activities for Actual session" })).toBeTruthy();
  });

  it("keeps day counts and empty-day actions consistent in weekly columns", async () => {
    const onAdd = vi.fn();
    render(PlanSection, {
      plan: [
        { id: "p1", day: "Mon", session: "First", activities: [] },
        { id: "p2", day: "Mon", session: "Second", activities: [] }
      ],
      collapsedDays: [],
      toggleDay: vi.fn(),
      onAdd,
      onUpdate: vi.fn(),
      onDelete: vi.fn()
    });

    expect(screen.getByRole("button", { name: "Collapse Mon" }).textContent).toContain("2");
    expect(screen.getByRole("button", { name: "Collapse Tue" }).textContent).toContain("0");
    await fireEvent.click(screen.getByTitle("Add planned session to Tue"));
    expect(onAdd).toHaveBeenCalledWith("Tue");

    cleanup();
    render(ActualSection, {
      actual: [
        { day: "Mon", session: "First", subjects: [], actualMinutes: 10, activities: [] },
        { day: "Mon", session: "Second", subjects: [], actualMinutes: 20, activities: [] }
      ],
      collapsedDays: [],
      toggleDay: vi.fn(),
      onRefresh: vi.fn()
    });

    expect(screen.getByRole("button", { name: "Collapse Mon" }).textContent).toContain("2");
    expect(screen.getByRole("button", { name: "Collapse Tue" }).textContent).toContain("0");
    expect(screen.getAllByText("No records").length).toBeGreaterThan(0);
  });

  it("keeps one weekly day expanded", async () => {
    weekStore.loaded = true;
    weekStore.descriptor = { year: 2026, week: 29, rangeLabel: "Jul 13 – Jul 19" };

    render(WeekPanel);
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      await fireEvent.click(screen.getAllByRole("button", { name: `Collapse ${day}` })[0]);
    }
    await fireEvent.click(screen.getAllByRole("button", { name: "Collapse Sun" })[0]);

    expect(screen.getAllByRole("button", { name: /^Expand / })).toHaveLength(12);
    expect(screen.getAllByRole("button", { name: "Collapse Sun" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Collapse Sun" })[0].getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("button", { name: "Collapse Sun" })[0].disabled).toBe(true);
  });

  it("restores a weekly session name when Escape cancels editing", async () => {
    const entry = { id: "p1", day: "Mon", session: "Development", activities: [] };
    const onUpdate = vi.fn((id, patch) => Object.assign(entry, patch));
    const onWindowEscape = vi.fn();
    window.addEventListener("keydown", onWindowEscape);
    render(PlanSection, { plan: [entry], onAdd: vi.fn(), onUpdate, onDelete: vi.fn() });

    await fireEvent.click(screen.getByRole("button", { name: "Development" }));
    const input = screen.getByPlaceholderText("What session?");
    await fireEvent.input(input, { target: { value: "Draft" } });
    await fireEvent.keyDown(input, { key: "Escape" });

    expect(onUpdate).toHaveBeenLastCalledWith("p1", { session: "Development" });
    expect(screen.queryByPlaceholderText("What session?")).toBeNull();
    expect(screen.getByRole("button", { name: "Development" })).toBeTruthy();
    expect(onWindowEscape).not.toHaveBeenCalled();
    window.removeEventListener("keydown", onWindowEscape);
  });

  it("offers usage-ranked history when editing a weekly planned session", async () => {
    const entry = { id: "p1", day: "Mon", session: "Development", activities: [] };
    const onUpdate = vi.fn((id, patch) => Object.assign(entry, patch));
    render(PlanSection, {
      plan: [entry],
      suggestions: [
        { name: "Research", plannedThisWeek: false },
        { name: "Deep Work", plannedThisWeek: false }
      ],
      onAdd: vi.fn(), onUpdate, onDelete: vi.fn()
    });

    await fireEvent.click(screen.getByRole("button", { name: "Development" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Research", "Deep Work"]);
    expect(document.querySelector(".planned-marker")).toBeNull();

    const input = screen.getByPlaceholderText("What session?");
    await fireEvent.input(input, { target: { value: "deep" } });
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdate).toHaveBeenLastCalledWith("p1", { session: "Deep Work" });
    expect(screen.getByRole("button", { name: "Deep Work" })).toBeTruthy();
  });

  it("emits weekly plan drag moves across cards and day drop zones", async () => {
    const onMove = vi.fn();
    const onMoveToDay = vi.fn();
    const { container } = render(PlanSection, {
      plan: [
        { id: "p1", day: "Mon", session: "Development", subjects: ["rust"], targetMinutes: 60, activities: [] },
        { id: "p2", day: "Tue", session: "Review", subjects: ["general"], targetMinutes: 30, activities: [] }
      ],
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onMove,
      onMoveToDay,
      onAddActivity: vi.fn(),
      onUpdateActivity: vi.fn(),
      onDeleteActivity: vi.fn(),
      onMoveActivity: vi.fn()
    });

    const reviewCard = screen.getByRole("button", { name: "Review" }).closest("article");
    reviewCard.getBoundingClientRect = () => ({ top: 10, bottom: 50, height: 40, left: 0, right: 100, width: 100 });
    document.elementsFromPoint = vi.fn(() => [reviewCard]);

    const handle = screen.getByRole("button", { name: "Reorder Development" });
    await fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    await fireEvent.pointerMove(window, { pointerId: 1, clientX: 0, clientY: 45 });
    await tick();
    expect(handle.closest("article").classList.contains("dragging")).toBe(true);
    expect(reviewCard.classList.contains("drop-after")).toBe(true);
    await fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 45 });
    expect(onMove).toHaveBeenCalledWith("p1", "p2", "after");

    const friColumn = [...container.querySelectorAll(".day-column")][4];
    const friTarget = friColumn.querySelector(".day-drop-target");
    document.elementsFromPoint = vi.fn(() => [friTarget]);
    await fireEvent.pointerDown(handle, { button: 0, pointerId: 2, clientX: 0, clientY: 0 });
    await fireEvent.pointerMove(window, { pointerId: 2, clientX: 0, clientY: 20 });
    await tick();
    const friZone = friColumn.querySelector(".day-drop-zone");
    expect(friZone.classList.contains("active")).toBe(true);
    await fireEvent.pointerUp(window, { pointerId: 2, clientX: 0, clientY: 20 });
    expect(onMoveToDay).toHaveBeenCalledWith("p1", "Fri");
  });

  it("opens weekly plan details and emits planned activity actions", async () => {
    const onAddActivity = vi.fn();
    const onMoveActivity = vi.fn();
    render(PlanSection, {
      plan: [{
        id: "p1",
        day: "Mon",
        session: "Development",
        subjects: ["rust"],
        targetMinutes: 60,
        activities: [{ id: "a1", subjects: ["rust"], minutes: 30, description: "Draft tests" }]
      }],
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onMove: vi.fn(),
      onAddActivity,
      onUpdateActivity: vi.fn(),
      onDeleteActivity: vi.fn(),
      onMoveActivity
    });

    await fireEvent.click(screen.getByRole("button", { name: "Open planned activities for Development" }));
    expect(screen.getByRole("dialog", { name: "Planned activities for Development" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Add activity" }));
    expect(onAddActivity).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("button", { name: "Move planned activity up" }).disabled).toBe(true);
  });

  it("marks Weekly Planned card and detail totals as incomplete", async () => {
    render(PlanSection, {
      plan: [{
        id: "p1",
        day: "Mon",
        session: "Development",
        activities: [
          { id: "known", subjects: ["rust"], minutes: 30, description: "Known" },
          { id: "unknown", subjects: ["test"], minutes: null, description: "Unknown" }
        ]
      }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(),
      onAddActivity: vi.fn(), onUpdateActivity: vi.fn(), onDeleteActivity: vi.fn(), onMoveActivity: vi.fn()
    });

    const planCard = screen.getByRole("button", { name: "Open planned activities for Development" });
    expect(within(planCard.closest(".plan-card")).getByText("30m+")).toBeTruthy();
    await fireEvent.click(planCard);
    expect(screen.getByText("Mon / 30m+ / 2 activities")).toBeTruthy();
  });

  it("lets subject suggestions overflow weekly plan details while the backdrop scrolls", async () => {
    subjectHistoryStore.history = {
      subjects: { backend: { count: 2, last_used: "2026-07-02T00:00:00.000Z" } }
    };
    render(PlanSection, {
      plan: [{
        id: "p1", day: "Mon", session: "Development",
        activities: [{ id: "a1", subjects: ["rust"], minutes: 30, description: "Draft tests" }]
      }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(),
      onMove: vi.fn(), onMoveToDay: vi.fn(), onAddActivity: vi.fn(),
      onUpdateActivity: vi.fn(), onDeleteActivity: vi.fn(), onMoveActivity: vi.fn()
    });

    await fireEvent.click(screen.getByRole("button", { name: "Open planned activities for Development" }));
    await fireEvent.click(screen.getByRole("button", { name: "rust" }));

    const subjectEditor = screen.getByRole("textbox", { name: "Edit subject rust" });
    const modal = subjectEditor.closest(".plan-modal");
    const backdrop = subjectEditor.closest(".modal-backdrop");
    expect(getComputedStyle(modal).overflow).toBe("visible");
    expect(getComputedStyle(backdrop).overflowY).toBe("auto");
  });

  it("closes weekly plan details with Escape and backdrop click", async () => {
    const props = {
      plan: [{
        id: "p1",
        day: "Mon",
        session: "Development",
        subjects: ["rust"],
        targetMinutes: 60,
        activities: [{ id: "a1", subjects: ["rust"], minutes: 30, description: "Draft tests" }]
      }],
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onMove: vi.fn(),
      onAddActivity: vi.fn(),
      onUpdateActivity: vi.fn(),
      onDeleteActivity: vi.fn(),
      onMoveActivity: vi.fn()
    };
    const view = render(PlanSection, props);

    await fireEvent.click(screen.getByRole("button", { name: "Open planned activities for Development" }));
    expect(screen.getByRole("dialog", { name: "Planned activities for Development" })).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Planned activities for Development" })).toBeNull();

    await view.rerender(props);
    await fireEvent.click(screen.getByRole("button", { name: "Open planned activities for Development" }));
    await fireEvent.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog", { name: "Planned activities for Development" })).toBeNull();
  });

  it("adds separate structure and clipboard actions to weekly planned activities", async () => {
    const onUpdateActivity = vi.fn();
    const onDeleteActivity = vi.fn();
    const onMoveActivity = vi.fn();
    render(PlanSection, {
      plan: [{
        id: "p1", day: "Mon", session: "Development",
        activities: [
          { id: "a1", subjects: ["rust"], minutes: 30, description: "First planned" },
          { id: "a2", subjects: ["test"], minutes: 20, description: "Second planned" }
        ]
      }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(),
      onMoveToDay: vi.fn(), onAddActivity: vi.fn(), onUpdateActivity,
      onDeleteActivity, onMoveActivity
    });

    await fireEvent.click(screen.getByRole("button", { name: "Open planned activities for Development" }));
    await fireEvent.contextMenu(screen.getByRole("button", { name: "First planned" }).closest(".planned-activity"));
    expect(screen.getByRole("menu", { name: "Planned activity actions" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Copy" })).toBeNull();
    await fireEvent.click(screen.getByRole("menuitem", { name: "Move Down" }));
    expect(onMoveActivity).toHaveBeenCalledWith("p1", "a1", "down");

    await fireEvent.click(screen.getByRole("button", { name: "First planned" }));
    const input = screen.getByPlaceholderText("Planned activity");
    input.setSelectionRange(0, 5);
    await fireEvent.contextMenu(input);
    expect(screen.getByRole("menuitem", { name: "Cut" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Planned activity actions" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Planned activities for Development" })).toBeTruthy();

    await fireEvent.contextMenu(screen.getByRole("button", { name: "Second planned" }).closest(".planned-activity"));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDeleteActivity).toHaveBeenCalledWith("p1", "a2");
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Planned activities for Development" })).toBeNull();
  });

  it("opens weekly actual read-only details and closes the modal", async () => {
    render(ActualSection, {
      actual: [{
        day: "Mon",
        session: "Development",
        subjects: ["rust", "test"],
        actualMinutes: 90,
        activities: [
          { description: "Draft tests", subjects: ["rust"], minutes: 60 },
          { description: "Review parser", subjects: ["test"], minutes: 30 }
        ]
      }],
      onRefresh: vi.fn()
    });

    await fireEvent.click(screen.getByRole("button", { name: "Open actual activities for Development" }));

    expect(screen.getByRole("dialog", { name: "Actual activities for Development" })).toBeTruthy();
    expect(screen.getByText("Mon / 90m / 2 activities")).toBeTruthy();
    expect(screen.getByText("Draft tests")).toBeTruthy();
    expect(screen.getByText("Review parser")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add activity" })).toBeNull();

    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Actual activities for Development" })).toBeNull();

    await fireEvent.click(screen.getByRole("button", { name: "Open actual activities for Development" }));
    await fireEvent.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog", { name: "Actual activities for Development" })).toBeNull();
  });

  it("marks Weekly Actual card and detail totals as incomplete", async () => {
    render(ActualSection, {
      actual: [{
        day: "Mon",
        session: "Development",
        subjects: ["rust"],
        actualMinutes: 30,
        unknownDurationCount: 1,
        activities: [
          { description: "Known", subjects: ["rust"], minutes: 30 },
          { description: "Unknown", subjects: ["test"], minutes: null }
        ]
      }],
      onRefresh: vi.fn()
    });

    const actualCard = screen.getByRole("button", { name: "Open actual activities for Development" });
    expect(within(actualCard).getByText("30m+")).toBeTruthy();
    await fireEvent.click(actualCard);
    expect(screen.getByText("Mon / 30m+ / 2 activities")).toBeTruthy();
    expect(screen.getByText("?")).toBeTruthy();
  });

  it("shows the mixed Weekly Planned section total", () => {
    render(PlanSection, {
      plan: [{
        id: "p1", day: "Mon", session: "Development",
        activities: [
          { id: "a1", subjects: ["rust"], minutes: 60, description: "Known" },
          { id: "a2", subjects: ["test"], minutes: null, description: "Unknown" }
        ]
      }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(),
      onMoveToDay: vi.fn(), onAddActivity: vi.fn(), onUpdateActivity: vi.fn(),
      onDeleteActivity: vi.fn(), onMoveActivity: vi.fn()
    });

    expect(screen.getByLabelText("Weekly planned total: 1h+")).toBeTruthy();
  });

  it("shows the mixed Weekly Actual section total", () => {
    render(ActualSection, {
      actual: [{
        day: "Mon",
        session: "Development",
        subjects: ["rust"],
        actualMinutes: 90,
        unknownDurationCount: 1,
        activities: []
      }],
      onRefresh: vi.fn()
    });

    expect(screen.getByLabelText("Weekly actual total: 1h 30m+")).toBeTruthy();
  });

  it("shows filtered weekly session suggestions when adding a daily session", async () => {
    const onAdd = vi.fn(() => true);
    render(AddSessionForm, {
      suggestions: [
        { name: "Deep Work", plannedThisWeek: true },
        { name: "Long planned session name that should be visible on hover", plannedThisWeek: false },
        { name: "Review", plannedThisWeek: false }
      ],
      existingSessions: ["Review"],
      onAdd
    });

    await fireEvent.click(screen.getByRole("button", { name: "Add session" }));
    expect(screen.getByRole("option", { name: "Deep Work" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Deep Work" }).querySelector(".planned-marker")?.textContent).toBe("*");
    expect(screen.getByRole("option", { name: "Deep Work" }).querySelector(".planned-marker")?.textContent).toBe("*");
    expect(screen.getByRole("option", { name: "Long planned session name that should be visible on hover" }).getAttribute("title")).toBe("Long planned session name that should be visible on hover");
    expect(screen.queryByRole("option", { name: "Review" })).toBeNull();

    await fireEvent.input(screen.getByPlaceholderText("Session name..."), { target: { value: "long" } });
    expect(screen.queryByRole("option", { name: "Deep Work" })).toBeNull();
    expect(screen.getByRole("option", { name: "Long planned session name that should be visible on hover" })).toBeTruthy();
  });

  it("preserves suggestion casing for exact typed session matches", async () => {
    const onAdd = vi.fn(() => true);
    render(AddSessionForm, { suggestions: [{ name: "Deep Work", plannedThisWeek: true }], existingSessions: [], onAdd });

    await fireEvent.click(screen.getByRole("button", { name: "Add session" }));
    await fireEvent.input(screen.getByPlaceholderText("Session name..."), { target: { value: "deep work" } });
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onAdd).toHaveBeenCalledWith("Deep Work");
  });

  it("merges weekly planned sessions before session history in the daily add form", async () => {
    dailyStore.loaded = true;
    dailyStore.date = "2026-07-05";
    dailyStore.sessions = [{ id: "session-existing", name: "Existing", activities: [] }];
    weekStore.plan = [
      { id: "p1", day: "Sun", session: "Alpha", subjects: ["general"], targetMinutes: 0, activities: [] },
      { id: "p2", day: "Sun", session: "beta", subjects: ["general"], targetMinutes: 0, activities: [] }
    ];
    sessionHistoryStore.history = {
      sessions: {
        alpha: { actual_count: 9, planned_count: 0, last_used: "2026-07-05T00:00:00.000Z" },
        Gamma: { actual_count: 5, planned_count: 0, last_used: "2026-07-04T00:00:00.000Z" },
        Existing: { actual_count: 4, planned_count: 0, last_used: "2026-07-04T00:00:00.000Z" }
      }
    };

    render(DailyPanel);

    await fireEvent.click(screen.getByRole("button", { name: "Add session" }));
    const options = screen.getAllByRole("option").map((option) => option.textContent);

    expect(options).toEqual(["*Alpha", "*beta", "Gamma"]);
  });

  it("does not show a suggestions dropdown when no suggestions are available", async () => {
    render(AddSessionForm, { suggestions: [], existingSessions: [], onAdd: vi.fn(() => true) });

    await fireEvent.click(screen.getByRole("button", { name: "Add session" }));

    expect(screen.queryByRole("option")).toBeNull();
  });

  it("edits objective status and subjects without an origin control", async () => {
    const onUpdate = vi.fn();
    render(ObjectiveRow, {
      objective: { subjects: ["rust"], status: "open", description: "Ship", indent: 0 },
      onUpdate, onDelete: vi.fn()
    });
    expect(document.querySelector(".origin-badge")).toBeNull();

    await fireEvent.click(screen.getByLabelText("Status"));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Partial" }));

    expect(onUpdate).toHaveBeenCalledWith({ status: "partial" });

    await fireEvent.input(screen.getByRole("textbox", { name: "Add subject" }), { target: { value: "weekly" } });
    await fireEvent.keyDown(screen.getByRole("textbox", { name: "Add subject" }), { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith({ subjects: ["rust", "weekly"] });
  });

  it("renders objective indentation and uses Tab and Shift+Tab without leaving the editor", async () => {
    const onIndent = vi.fn();
    const onOutdent = vi.fn();
    const { container } = render(ObjectiveRow, {
      objective: { subjects: ["rust"], status: "open", description: "Nested", indent: 2 },
      onUpdate: vi.fn(), onDelete: vi.fn(), onIndent, onOutdent
    });

    expect(container.querySelector(".objective-card").style.marginLeft).toBe("48px");
    await fireEvent.click(screen.getByText("Nested"));
    const input = screen.getByPlaceholderText("Objective description");
    expect(document.activeElement).toBe(input);

    expect(await fireEvent.keyDown(input, { key: "Tab" })).toBe(false);
    expect(onIndent).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
    expect(await fireEvent.keyDown(input, { key: "Tab", shiftKey: true })).toBe(false);
    expect(onOutdent).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
  });

  it("folds and unfolds indented objective rows", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    let foldedObjectiveIds = [];
    let rendered;
    const props = {
      objectives: [
        { id: "parent", subjects: ["general"], status: "open", description: "Parent", indent: 0 },
        { id: "child", subjects: ["general"], status: "open", description: "Child", indent: 1 },
        { id: "sibling", subjects: ["general"], status: "open", description: "Sibling", indent: 0 }
      ],
      foldedObjectiveIds,
      onFoldChange: async (ids) => {
        foldedObjectiveIds = ids;
        await rendered.rerender({ ...props, foldedObjectiveIds });
      },
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    };
    rendered = render(ObjectivesSection, props);

    expect(screen.getByText("Child")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Collapse objective" }));
    expect(screen.queryByText("Child")).toBeNull();
    expect(screen.getByText("Sibling")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Expand objective" }));
    expect(screen.getByText("Child")).toBeTruthy();
  });

  it("preserves objective folds when the weekly panel remounts", async () => {
    weekStore.path = "A.md";
    weekStore.loaded = true;
    weekStore.descriptor = { year: 2026, week: 26, rangeLabel: "June 22-28" };
    weekStore.objectives = [
      { id: "parent", subjects: ["general"], status: "open", description: "Parent", indent: 0 },
      { id: "child", subjects: ["general"], status: "open", description: "Child", indent: 1 }
    ];
    weekStore.plan = [];
    weekStore.actual = [];

    const firstMount = render(WeekPanel);
    expect(screen.getByText("Child")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Collapse objective" }));
    expect(screen.queryByText("Child")).toBeNull();
    expect(weekStore.foldedObjectiveIds).toEqual(["parent"]);

    firstMount.unmount();
    render(WeekPanel);

    expect(screen.queryByText("Child")).toBeNull();
    expect(screen.getByRole("button", { name: "Expand objective" })).toBeTruthy();
  });

  it("offers single-objective structure actions from the context menu", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    const onIndent = vi.fn();
    const onOutdent = vi.fn();
    const onMove = vi.fn();
    const onDelete = vi.fn();
    render(ObjectivesSection, {
      objectives: [
        { id: "first", subjects: [], status: "open", description: "First", indent: 0 },
        { id: "target", subjects: [], status: "open", description: "Target", indent: 1 },
        { id: "last", subjects: [], status: "open", description: "Last", indent: 0 }
      ],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete, onMove, onIndent, onOutdent
    });

    const targetRow = screen.getByText("Target").closest("article");
    await fireEvent.contextMenu(targetRow, { clientX: 40, clientY: 50 });
    expect(screen.getByRole("menu", { name: "Objective actions" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Copy" })).toBeNull();
    await fireEvent.click(screen.getByRole("menuitem", { name: "Indent" }));
    expect(onIndent).toHaveBeenCalledWith("target");
    expect(screen.queryByRole("menu", { name: "Objective actions" })).toBeNull();

    await fireEvent.contextMenu(targetRow);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Outdent" }));
    expect(onOutdent).toHaveBeenCalledWith("target");

    await fireEvent.contextMenu(targetRow);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Move Up" }));
    expect(onMove).toHaveBeenCalledWith("target", "up");

    await fireEvent.contextMenu(targetRow);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Move Down" }));
    expect(onMove).toHaveBeenCalledWith("target", "down");

    await fireEvent.contextMenu(targetRow);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("target");
  });

  it("collapses and expands all foldable objectives from the context menu", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    let foldedObjectiveIds = [];
    let rendered;
    const props = {
      objectives: [
        { id: "parent", subjects: [], status: "open", description: "Parent", indent: 0 },
        { id: "child", subjects: [], status: "open", description: "Child", indent: 1 },
        { id: "grandchild", subjects: [], status: "open", description: "Grandchild", indent: 2 },
        { id: "sibling", subjects: [], status: "open", description: "Sibling", indent: 0 }
      ],
      foldedObjectiveIds,
      onFoldChange: async (ids) => {
        foldedObjectiveIds = ids;
        await rendered.rerender({ ...props, foldedObjectiveIds });
      },
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    };
    rendered = render(ObjectivesSection, props);

    await fireEvent.contextMenu(screen.getByText("Parent").closest("article"));
    expect(screen.getByRole("menuitem", { name: "Collapse All Objectives" }).disabled).toBe(false);
    expect(screen.getByRole("menuitem", { name: "Expand All Objectives" }).disabled).toBe(true);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Collapse All Objectives" }));

    expect(foldedObjectiveIds).toEqual(["parent", "child"]);
    expect(screen.queryByText("Child")).toBeNull();
    expect(screen.queryByRole("menu", { name: "Objective actions" })).toBeNull();

    await fireEvent.contextMenu(screen.getByText("Parent").closest("article"));
    expect(screen.getByRole("menuitem", { name: "Collapse All Objectives" }).disabled).toBe(true);
    expect(screen.getByRole("menuitem", { name: "Expand All Objectives" }).disabled).toBe(false);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Expand All Objectives" }));

    expect(foldedObjectiveIds).toEqual([]);
    expect(screen.getByText("Child")).toBeTruthy();
    expect(screen.getByText("Grandchild")).toBeTruthy();
  });

  it("disables unavailable objective context actions and closes with Escape", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    render(ObjectivesSection, {
      objectives: [{ id: "only", subjects: [], status: "open", description: "Only", indent: 0 }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    await fireEvent.contextMenu(screen.getByText("Only").closest("article"));
    expect(screen.getByRole("menuitem", { name: "Outdent" }).disabled).toBe(true);
    expect(screen.getByRole("menuitem", { name: "Move Up" }).disabled).toBe(true);
    expect(screen.getByRole("menuitem", { name: "Move Down" }).disabled).toBe(true);
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Objective actions" })).toBeNull();
  });

  it("adds focus-preserving text actions to editable objective targets", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    render(ObjectivesSection, {
      objectives: [{ id: "objective", subjects: ["rust"], status: "open", description: "Editable objective", indent: 0 }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    await fireEvent.click(screen.getByText("Editable objective"));
    const description = screen.getByPlaceholderText("Objective description");
    description.setSelectionRange(0, 8);
    await fireEvent.contextMenu(description);

    const cut = screen.getByRole("menuitem", { name: "Cut" });
    const copy = screen.getByRole("menuitem", { name: "Copy" });
    expect(cut.disabled).toBe(false);
    expect(copy.disabled).toBe(false);
    expect(screen.getByRole("menuitem", { name: "Paste" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Select All" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    expect(await fireEvent.pointerDown(copy)).toBe(false);
    expect(document.activeElement).toBe(description);
    expect(description.selectionStart).toBe(0);
    expect(description.selectionEnd).toBe(8);

    await fireEvent.keyDown(window, { key: "Escape" });
    description.setSelectionRange(3, 3);
    await fireEvent.contextMenu(description);
    expect(screen.getByRole("menuitem", { name: "Cut" }).disabled).toBe(true);
    expect(screen.getByRole("menuitem", { name: "Copy" }).disabled).toBe(true);
    await fireEvent.keyDown(window, { key: "Escape" });

    const subjectInput = screen.getByRole("textbox", { name: "Add subject" });
    await fireEvent.contextMenu(subjectInput);
    expect(screen.getByRole("menuitem", { name: "Paste" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Indent" })).toBeTruthy();
    readText.mockRejectedValueOnce(new Error("denied"));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Paste" }));
    await vi.waitFor(() => expect(appStore.statusMessage).toContain("Clipboard failed: Error: denied"));
  });

  it("selects all text in the active objective editor from its context menu", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    render(ObjectivesSection, {
      objectives: [{ id: "objective", subjects: [], status: "open", description: "Select this objective", indent: 0 }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    await fireEvent.click(screen.getByText("Select this objective"));
    const description = screen.getByPlaceholderText("Objective description");
    description.setSelectionRange(4, 4);
    await fireEvent.contextMenu(description);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Select All" }));

    expect(document.activeElement).toBe(description);
    expect(description.selectionStart).toBe(0);
    expect(description.selectionEnd).toBe(description.value.length);
    expect(screen.queryByRole("menu", { name: "Objective actions" })).toBeNull();
  });

  it("routes objective Cut and Paste through existing input updates", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    const onUpdate = vi.fn();
    render(ObjectivesSection, {
      objectives: [{ id: "objective", subjects: ["rust"], status: "open", description: "Editable objective", indent: 0 }],
      onAdd: vi.fn(), onUpdate, onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    await fireEvent.click(screen.getByText("Editable objective"));
    const description = screen.getByPlaceholderText("Objective description");
    description.setSelectionRange(0, 8);
    await fireEvent.contextMenu(description);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Cut" }));
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith("objective", { description: " objective" }));
    expect(writeText).toHaveBeenCalledWith("Editable");

    readText.mockResolvedValueOnce("Updated");
    description.setSelectionRange(0, 0);
    await fireEvent.contextMenu(description);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Paste" }));
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith("objective", { description: "Updated objective" }));
  });

  it("emits Weekly objective move actions", async () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    render(ObjectiveRow, {
      objective: { subjects: ["rust"], status: "open", description: "Move objective", indent: 0 },
      canMoveUp: true,
      canMoveDown: true,
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onMoveUp,
      onMoveDown
    });

    await fireEvent.click(screen.getByRole("button", { name: "Move objective up" }));
    await fireEvent.click(screen.getByRole("button", { name: "Move objective down" }));

    expect(onMoveUp).toHaveBeenCalledOnce();
    expect(onMoveDown).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Delete objective" })).toBeTruthy();
  });
});
