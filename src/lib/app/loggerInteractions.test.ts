import type { ComponentProps } from "svelte";
import { activityProps } from "./componentTestProps.ts";
import { requireValue } from "$lib/shared/testing/testHelpers.ts";
import { sessionProps, planProps, actualProps, objectiveProps } from "./componentTestProps.ts";
// @vitest-environment jsdom
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
import { todoFoldStore } from "$lib/features/todo/todoFolding.svelte.ts";
import { todoUiState } from "$lib/features/todo/todoUiState.svelte.ts";
import { todoStore } from "$lib/features/todo/todoStore.svelte.ts";
import { dailyStore } from "$lib/features/daily/dailyStore.svelte.ts";
import { weekStore } from "$lib/features/weekly/weekStore.svelte.ts";
import { workspaceStore } from "./workspaceStore.svelte.ts";
import { appStore } from "./appStore.svelte.ts";
import { subjectHistoryStore } from "./subjectHistoryStore.svelte.ts";
import { sessionHistoryStore } from "./sessionHistoryStore.svelte.ts";
import { scratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.ts";
import { formatDate, getWeekDescriptor } from "$lib/shared/services/logWorkspaceService.ts";
import * as logWorkspaceService from "$lib/shared/services/logWorkspaceService.ts";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openPath } from "@tauri-apps/plugin-opener";
import { EditorView } from "@codemirror/view";

import { installInteractionTestSetup } from './interactionTestSetup.ts';

installInteractionTestSetup();

describe("logger editing", () => {
  it("renders and edits subjects as individual pills", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust", "programming"], onChange, variant: "badge" });

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "rust" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "programming" })).toBeTruthy();

    const addInput = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" });
    await fireEvent.input(requireValue(addInput), { target: { value: "testing" } });
    await fireEvent.keyDown(requireValue(addInput), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["rust", "programming", "testing"]);

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "rust" })));
    const editInput = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Edit subject rust" });
    await fireEvent.input(requireValue(editInput), { target: { value: "backend" } });
    await fireEvent.keyDown(requireValue(editInput), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["backend", "programming"]);
  });

  it("commits subject additions with comma and Tab", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust"], onChange, variant: "badge" });
    const addInput = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" });

    await fireEvent.input(requireValue(addInput), { target: { value: "cli" } });
    await fireEvent.keyDown(requireValue(addInput), { key: "," });
    expect(onChange).toHaveBeenCalledWith(["rust", "cli"]);

    await fireEvent.input(requireValue(addInput), { target: { value: "web" } });
    await fireEvent.keyDown(requireValue(addInput), { key: "Tab" });
    expect(onChange).toHaveBeenCalledWith(["rust", "web"]);
  });

  it("rejects invalid and duplicate subject additions", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust"], onChange, variant: "badge" });
    const addInput = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" });

    await fireEvent.input(requireValue(addInput), { target: { value: "bad subject" } });
    await fireEvent.keyDown(requireValue(addInput), { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Invalid or duplicate subject")).toBeTruthy();

    await fireEvent.input(requireValue(addInput), { target: { value: "RUST" } });
    await fireEvent.keyDown(requireValue(addInput), { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes subjects but prevents empty subject lists", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust", "test"], onChange, variant: "badge" });
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Remove test" })));
    expect(onChange).toHaveBeenCalledWith(["rust"]);

    cleanup();
    const singleChange = vi.fn();
    render(SubjectInput, { subjects: ["rust"], onChange: singleChange, variant: "badge" });
    expect(screen.queryByRole("button", { name: "Remove rust" })).toBeNull();
    const addInput = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" });
    await fireEvent.keyDown(requireValue(addInput), { key: "Backspace" });
    expect(singleChange).not.toHaveBeenCalled();
  });

  it("removes the previous subject with Backspace on an empty add input", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["rust", "test"], onChange, variant: "badge" });
    const addInput = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" });

    await fireEvent.keyDown(requireValue(addInput), { key: "Backspace" });

    expect(onChange).toHaveBeenCalledWith(["rust"]);
  });

  it("cancels subject add and edit input with Escape", async () => {
    const onChange = vi.fn();
    const onWindowEscape = vi.fn();
    window.addEventListener("keydown", onWindowEscape);
    render(SubjectInput, { subjects: ["rust", "test"], onChange, variant: "badge" });
    const addInput = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" });

    await fireEvent.input(requireValue(addInput), { target: { value: "cli" } });
    await fireEvent.keyDown(requireValue(addInput), { key: "Escape" });
    expect(addInput.value).toBe("");
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "rust" })));
    await fireEvent.keyDown(requireValue(screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Edit subject rust" })), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Edit subject rust" })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(onWindowEscape).not.toHaveBeenCalled();
    window.removeEventListener("keydown", onWindowEscape);
  });

  it("cancels an empty pill edit before starting a new pill", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["general"], onChange, variant: "badge" });

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "general" })));
    const editInput = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Edit subject general" });
    await fireEvent.input(requireValue(editInput), { target: { value: "" } });

    const addInput = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" });
    await fireEvent.focus(requireValue(addInput));
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(screen.queryByRole("textbox", { name: "Edit subject general" })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "general" })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.input(requireValue(addInput), { target: { value: "programming" } });
    await fireEvent.keyDown(requireValue(addInput), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["general", "programming"]);
  });

  it("restores an existing pill when an empty edit loses focus", async () => {
    const onChange = vi.fn();
    render(SubjectInput, { subjects: ["general"], onChange, variant: "badge" });

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "general" })));
    const editInput = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Edit subject general" });
    await fireEvent.input(requireValue(editInput), { target: { value: "" } });
    await fireEvent.blur(requireValue(editInput));

    expect(screen.queryByRole("textbox", { name: "Edit subject general" })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "general" })).toBeTruthy();
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

    const addInput = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" });
    await fireEvent.focus(requireValue(addInput));
    expect(screen.queryByRole("option", { name: "rust" })).toBeNull();
    expect(screen.getByRole("option", { name: "backend" })).toBeTruthy();

    await fireEvent.input(requireValue(addInput), { target: { value: "front" } });
    expect(screen.queryByRole("option", { name: "backend" })).toBeNull();
    await fireEvent.click(requireValue(screen.getByRole("option", { name: "frontend" })));

    expect(onChange).toHaveBeenCalledWith(["rust", "frontend"]);
    expect(record).toHaveBeenCalledWith(["frontend"]);
  });

  it("emits Daily activity edits", async () => {
    const onUpdate = vi.fn();
    render(ActivityRow, {...activityProps(), activity: {id:"fixture-activity", subjects: ["rust"], minutes: 20, description: "Old" }, onUpdate, onDelete: vi.fn() });

    // Open minutes editor by clicking the badge
    await fireEvent.click(requireValue(screen.getByLabelText("Edit minutes spent")));
    await fireEvent.input(requireValue(screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Edit minutes spent" })), { target: { value: "45" } });

    // Open description editor by clicking the description text
    await fireEvent.click(requireValue(screen.getByText("Old")));
    await fireEvent.input(requireValue(screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("What happened?")), { target: { value: "New description" } });

    expect(onUpdate).toHaveBeenCalledWith({ minutes: 45 });
    expect(onUpdate).toHaveBeenCalledWith({ description: "New description" });

    await fireEvent.input(requireValue(screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" })), { target: { value: "daily" } });
    await fireEvent.keyDown(requireValue(screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" })), { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith({ subjects: ["rust", "daily"] });
  });

  it("emits Daily activity move actions", async () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    render(ActivityRow, {...activityProps(),
      activity: {id:"fixture-activity", subjects: ["rust"], minutes: 20, description: "Move me" },
      canMoveUp: true,
      canMoveDown: true,
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onMoveUp,
      onMoveDown
    });

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Move activity up" })));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Move activity down" })));

    expect(onMoveUp).toHaveBeenCalledOnce();
    expect(onMoveDown).toHaveBeenCalledOnce();
  });

  it("renders a session drag handle and emits pointer drag callbacks", async () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const onDragOver = vi.fn();
    const onDrop = vi.fn();
    render(SessionCard, {...sessionProps(),
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

    const handle = screen.getByRole<HTMLButtonElement>("button", { name: "Reorder Work" });
    await fireEvent.pointerDown(requireValue(handle), { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    await fireEvent.pointerMove(window, { pointerId: 1, clientX: 0, clientY: 12 });
    await fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 12 });

    expect(onDragStart).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }));
    expect(onDragEnd).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }));
    expect(onDragOver).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("shows suggestions when renaming a daily session", async () => {
    const onRenameSession = vi.fn(() => true);
    render(SessionCard, {...sessionProps(),
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

    await fireEvent.click(requireValue(screen.getByText("Work")));

    expect(screen.getByRole("option", { name: "Deep Work" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Long renamed session" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Review" })).toBeNull();

    await fireEvent.input(requireValue(screen.getByDisplayValue<HTMLInputElement | HTMLTextAreaElement>("Work")), { target: { value: "long" } });
    expect(screen.queryByRole("option", { name: "Deep Work" })).toBeNull();
    await fireEvent.click(requireValue(screen.getByRole("option", { name: "Long renamed session" })));

    expect(onRenameSession).toHaveBeenCalledWith("Long renamed session");
  });

  it("cancels a daily session rename with Escape", async () => {
    const onRenameSession = vi.fn(() => true);
    const onWindowEscape = vi.fn();
    window.addEventListener("keydown", onWindowEscape);
    render(SessionCard, {...sessionProps(),
      session: { id: "session-1", name: "Work", activities: [] },
      dragState: null,
      onAddActivity: vi.fn(), onUpdateActivity: vi.fn(), onDeleteActivity: vi.fn(),
      onMoveActivity: vi.fn(), onDeleteSession: vi.fn(), onRenameSession,
      onDragStart: vi.fn(), onDragOver: vi.fn(), onDragLeave: vi.fn(),
      onDrop: vi.fn(), onDragEnd: vi.fn()
    });

    await fireEvent.click(requireValue(screen.getByText("Work")));
    const input = screen.getByDisplayValue<HTMLInputElement | HTMLTextAreaElement>("Work");
    await fireEvent.input(requireValue(input), { target: { value: "Draft" } });
    await fireEvent.keyDown(requireValue(input), { key: "Escape" });

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
    await fireEvent.contextMenu(requireValue(screen.getByText("First session").closest<HTMLElement>(".session-card")));
    expect(screen.getByRole("menu", { name: "Session actions" })).toBeTruthy();
    expect(screen.queryByRole("menu", { name: "Activity actions" })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Move Up" }).disabled).toBe(true);
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Move Down" })));
    expect(moveSessionTo).toHaveBeenCalledWith("s1", "s2", "after");

    await fireEvent.contextMenu(requireValue(screen.getByText("First activity").closest<HTMLElement>(".activity-card")));
    expect(screen.getByRole("menu", { name: "Activity actions" })).toBeTruthy();
    expect(screen.queryByRole("menu", { name: "Session actions" })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Move Up" }).disabled).toBe(true);
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Move Down" })));
    expect(moveActivity).toHaveBeenCalledWith("s1", "a1", "down");

    await fireEvent.contextMenu(requireValue(screen.getByText("Second activity").closest<HTMLElement>(".activity-card")));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Delete" })));
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
    await fireEvent.click(requireValue(screen.getByText("Session name")));
    const sessionInput = screen.getByDisplayValue<HTMLInputElement | HTMLTextAreaElement>("Session name");
    sessionInput.setSelectionRange(0, 7);
    await fireEvent.contextMenu(requireValue(sessionInput));
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Delete" })).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });

    await fireEvent.click(requireValue(screen.getByText("Activity text")));
    const activityInput = screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("What happened?");
    activityInput.setSelectionRange(0, 8);
    await fireEvent.contextMenu(requireValue(activityInput));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Cut" })));
    await vi.waitFor(() => expect(dailyStore.sessions[0].activities[0].description).toBe(" text"));
    expect(writeText).toHaveBeenCalledWith("Activity");
  });

  it("renders a zero-minute default when TimeInput has no minutes prop", async () => {
    const { default: TimeInput } = await import("$lib/shared/components/TimeInput.svelte");
    render(TimeInput, { onChange: vi.fn(), variant: "badge" });
    expect(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Edit minutes spent" }).textContent).trim()).toBe("0m");
  });

  it("emits Weekly plan edits", async () => {
    const onUpdate = vi.fn();
    render(PlanSection, {...planProps(),
      plan: [{ id: "p1", day: "Mon", session: "Development", subjects: ["stale"], targetMinutes: 99, activities: [{ id: "a1", subjects: ["rust"], minutes: 60, description: "Build" }] }],
      onAdd: vi.fn(), onUpdate, onDelete: vi.fn()
    });
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Development" })));
    await fireEvent.input(requireValue(screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("What session?")), { target: { value: "Review" } });
    expect(onUpdate).toHaveBeenCalledWith("p1", { session: "Review" });
    expect(screen.getByText("60m")).toBeTruthy();
    expect(screen.getByText("rust")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Add subject" })).toBeNull();
  });

  it("duplicates a Weekly Planned card from its context menu", async () => {
    const onDuplicate = vi.fn();
    render(PlanSection, {...planProps(),
      plan: [{ id: "p1", day: "Mon", session: "Development", subjects: ["rust"], targetMinutes: 60, activities: [] }],
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate
    });

    await fireEvent.contextMenu(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Development" }).closest<HTMLElement>("article")));
    expect(screen.getByRole("menu", { name: "Planned session actions" }).style.width).toBe("112px");
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Duplicate" })));

    expect(onDuplicate).toHaveBeenCalledWith("p1");
    expect(screen.queryByRole("menu", { name: "Planned session actions" })).toBeNull();
  });

  it("offers standard clipboard actions in the Weekly Planned session input", async () => {
    render(PlanSection, {...planProps(),
      plan: [{ id: "p1", day: "Mon", session: "Development", subjects: ["rust"], targetMinutes: 60, activities: [] }],
      onAdd: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate: vi.fn()
    });

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Development" })));
    const input = screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("What session?");
    input.setSelectionRange(0, 7);
    await fireEvent.contextMenu(requireValue(input));

    expect(screen.getByRole("menu", { name: "Planned session text actions" }).style.width).toBe("196px");
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Cut" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Paste" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Select All" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Duplicate" })).toBeNull();

    await fireEvent.pointerDown(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Copy" })));
    expect(document.activeElement).toBe(input);
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Copy" })));
    expect(writeText).toHaveBeenCalledWith("Develop");
  });

  it("edits unknown durations without conflating them with zero", async () => {
    const onUpdate = vi.fn();
    render(ActivityRow, {...activityProps(),
      activity: {id:"fixture-activity", subjects: ["general"], minutes: null, description: "Estimate later" },
      onUpdate,
      onDelete: vi.fn()
    });

    const badge = screen.getByRole<HTMLButtonElement>("button", { name: "Edit minutes spent" });
    expect(requireValue(badge.textContent).trim()).toBe("?");
    await fireEvent.click(requireValue(badge));
    const input = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Edit minutes spent" });
    await fireEvent.input(requireValue(input), { target: { value: "?" } });
    await fireEvent.keyDown(requireValue(input), { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith({ minutes: null });
  });

  it("marks existing Daily totals as incomplete when durations are unknown", () => {
    render(DailyHeader, { date: "2026-07-25", totalMinutes: 100, unknownDurationCount: 1 });
    expect(screen.getByText("1h 40m+")).toBeTruthy();
    expect(screen.getByText("100 known minutes")).toBeTruthy();
  });

  it("marks Daily session subtotals as incomplete", () => {
    render(SessionCard, {...sessionProps(),
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
    weekStore.plan = [{subjects:[], id: "p1", day: "Mon", session: "Plan session", activities: [] }];
    weekStore.actual = [{ day: "Mon", session: "Actual session", subjects: [], actualMinutes: 30, activities: [] }];

    const { container } = render(WeekPanel);
    const collapseMonday = screen.getAllByRole("button", { name: "Collapse Mon" });
    expect(collapseMonday).toHaveLength(2);
    await fireEvent.click(requireValue(collapseMonday[0]));

    expect(screen.queryByRole("button", { name: "Plan session" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open actual activities for Actual session" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Expand Mon" })).toHaveLength(2);
    expect(requireValue(container.querySelector<HTMLElement>("#plan .week-board")).style.gridTemplateColumns.startsWith("56px")).toBe(true);
    expect(requireValue(container.querySelector<HTMLElement>("#actual .week-board")).style.gridTemplateColumns.startsWith("56px")).toBe(true);

    await fireEvent.click(requireValue(screen.getAllByRole("button", { name: "Expand Mon" })[1]));
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Plan session" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Open actual activities for Actual session" })).toBeTruthy();
  });

  it("keeps day counts and empty-day actions consistent in weekly columns", async () => {
    const onAdd = vi.fn();
    render(PlanSection, {...planProps(),
      plan: [
        {subjects:[], id: "p1", day: "Mon", session: "First", activities: [] },
        {subjects:[], id: "p2", day: "Mon", session: "Second", activities: [] }
      ],
      collapsedDays: [],
      toggleDay: vi.fn(),
      onAdd,
      onUpdate: vi.fn(),
      onDelete: vi.fn()
    });

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Collapse Mon" }).textContent).toContain("2");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Collapse Tue" }).textContent).toContain("0");
    await fireEvent.click(requireValue(screen.getByTitle("Add planned session to Tue")));
    expect(onAdd).toHaveBeenCalledWith("Tue");

    cleanup();
    render(ActualSection, {...actualProps(),
      actual: [
        { day: "Mon", session: "First", subjects: [], actualMinutes: 10, activities: [] },
        { day: "Mon", session: "Second", subjects: [], actualMinutes: 20, activities: [] }
      ],
      collapsedDays: [],
      toggleDay: vi.fn(),
      onRefresh: vi.fn()
    });

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Collapse Mon" }).textContent).toContain("2");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Collapse Tue" }).textContent).toContain("0");
    expect(screen.getAllByText("No records").length).toBeGreaterThan(0);
  });

  it("keeps one weekly day expanded", async () => {
    weekStore.loaded = true;
    weekStore.descriptor = { year: 2026, week: 29, rangeLabel: "Jul 13 – Jul 19" };

    render(WeekPanel);
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      await fireEvent.click(requireValue(screen.getAllByRole("button", { name: `Collapse ${day}` })[0]));
    }
    await fireEvent.click(requireValue(screen.getAllByRole<HTMLButtonElement>("button", { name: "Collapse Sun" })[0]));

    expect(screen.getAllByRole("button", { name: /^Expand / })).toHaveLength(12);
    expect(screen.getAllByRole<HTMLButtonElement>("button", { name: "Collapse Sun" })).toHaveLength(2);
    expect(screen.getAllByRole<HTMLButtonElement>("button", { name: "Collapse Sun" })[0].getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole<HTMLButtonElement>("button", { name: "Collapse Sun" })[0].disabled).toBe(true);
  });

  it("restores a weekly session name when Escape cancels editing", async () => {
    const entry = {subjects:[], id: "p1", day: "Mon", session: "Development", activities: [] };
    const onUpdate = vi.fn((id, patch) => Object.assign(entry, patch));
    const onWindowEscape = vi.fn();
    window.addEventListener("keydown", onWindowEscape);
    render(PlanSection, {...planProps(), plan: [entry], onAdd: vi.fn(), onUpdate, onDelete: vi.fn() });

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Development" })));
    const input = screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("What session?");
    await fireEvent.input(requireValue(input), { target: { value: "Draft" } });
    await fireEvent.keyDown(requireValue(input), { key: "Escape" });

    expect(onUpdate).toHaveBeenLastCalledWith("p1", { session: "Development" });
    expect(screen.queryByPlaceholderText("What session?")).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Development" })).toBeTruthy();
    expect(onWindowEscape).not.toHaveBeenCalled();
    window.removeEventListener("keydown", onWindowEscape);
  });

  it("offers usage-ranked history when editing a weekly planned session", async () => {
    const entry = {subjects:[], id: "p1", day: "Mon", session: "Development", activities: [] };
    const onUpdate = vi.fn((id, patch) => Object.assign(entry, patch));
    render(PlanSection, {...planProps(),
      plan: [entry],
      suggestions: [
        { name: "Research", plannedThisWeek: false },
        { name: "Deep Work", plannedThisWeek: false }
      ],
      onAdd: vi.fn(), onUpdate, onDelete: vi.fn()
    });

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Development" })));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Research", "Deep Work"]);
    expect(document.querySelector<HTMLElement>(".planned-marker")).toBeNull();

    const input = screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("What session?");
    await fireEvent.input(requireValue(input), { target: { value: "deep" } });
    await fireEvent.keyDown(requireValue(input), { key: "ArrowDown" });
    await fireEvent.keyDown(requireValue(input), { key: "Enter" });

    expect(onUpdate).toHaveBeenLastCalledWith("p1", { session: "Deep Work" });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Deep Work" })).toBeTruthy();
  });

  it("emits weekly plan drag moves across cards and day drop zones", async () => {
    const onMove = vi.fn();
    const onMoveToDay = vi.fn();
    const { container } = render(PlanSection, {...planProps(),
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

    const reviewCard = requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Review" }).closest<HTMLElement>("article"));
    reviewCard.getBoundingClientRect = () => ({x:0,y:0,toJSON(){return {};}, top: 10, bottom: 50, height: 40, left: 0, right: 100, width: 100 });
    document.elementsFromPoint = vi.fn(() => [reviewCard]);

    const handle = screen.getByRole<HTMLButtonElement>("button", { name: "Reorder Development" });
    await fireEvent.pointerDown(requireValue(handle), { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    await fireEvent.pointerMove(window, { pointerId: 1, clientX: 0, clientY: 45 });
    await tick();
    expect(requireValue(handle.closest<HTMLElement>("article")).classList.contains("dragging")).toBe(true);
    expect(reviewCard.classList.contains("drop-after")).toBe(true);
    await fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 45 });
    expect(onMove).toHaveBeenCalledWith("p1", "p2", "after");

    const friColumn = [...container.querySelectorAll<HTMLElement>(".day-column")][4];
    const friTarget = requireValue(friColumn.querySelector<HTMLElement>(".day-drop-target"));
    document.elementsFromPoint = vi.fn(() => [friTarget]);
    await fireEvent.pointerDown(requireValue(handle), { button: 0, pointerId: 2, clientX: 0, clientY: 0 });
    await fireEvent.pointerMove(window, { pointerId: 2, clientX: 0, clientY: 20 });
    await tick();
    const friZone = requireValue(friColumn.querySelector<HTMLElement>(".day-drop-zone"));
    expect(friZone.classList.contains("active")).toBe(true);
    await fireEvent.pointerUp(window, { pointerId: 2, clientX: 0, clientY: 20 });
    expect(onMoveToDay).toHaveBeenCalledWith("p1", "Fri");
  });

  it("opens weekly plan details and emits planned activity actions", async () => {
    const onAddActivity = vi.fn();
    const onMoveActivity = vi.fn();
    render(PlanSection, {...planProps(),
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

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Open planned activities for Development" })));
    expect(screen.getByRole("dialog", { name: "Planned activities for Development" })).toBeTruthy();
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Add activity" })));
    expect(onAddActivity).toHaveBeenCalledWith("p1");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Move planned activity up" }).disabled).toBe(true);
  });

  it("marks Weekly Planned card and detail totals as incomplete", async () => {
    render(PlanSection, {...planProps(),
      plan: [{subjects:[],
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

    const planCard = screen.getByRole<HTMLButtonElement>("button", { name: "Open planned activities for Development" });
    expect(within(requireValue(planCard.closest<HTMLElement>(".plan-card"))).getByText("30m+")).toBeTruthy();
    await fireEvent.click(requireValue(planCard));
    expect(screen.getByText("Mon / 30m+ / 2 activities")).toBeTruthy();
  });

  it("lets subject suggestions overflow weekly plan details while the backdrop scrolls", async () => {
    subjectHistoryStore.history = {
      subjects: { backend: { count: 2, last_used: "2026-07-02T00:00:00.000Z" } }
    };
    render(PlanSection, {...planProps(),
      plan: [{subjects:[],
        id: "p1", day: "Mon", session: "Development",
        activities: [{ id: "a1", subjects: ["rust"], minutes: 30, description: "Draft tests" }]
      }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(),
      onMove: vi.fn(), onMoveToDay: vi.fn(), onAddActivity: vi.fn(),
      onUpdateActivity: vi.fn(), onDeleteActivity: vi.fn(), onMoveActivity: vi.fn()
    });

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Open planned activities for Development" })));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "rust" })));

    const subjectEditor = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Edit subject rust" });
    const modal = requireValue(subjectEditor.closest<HTMLElement>(".plan-modal"));
    const backdrop = requireValue(subjectEditor.closest<HTMLElement>(".modal-backdrop"));
    expect(getComputedStyle(requireValue(modal)).overflow).toBe("visible");
    expect(getComputedStyle(requireValue(backdrop)).overflowY).toBe("auto");
  });

  it("closes weekly plan details with Escape and backdrop click", async () => {
    const props = {...planProps(),
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

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Open planned activities for Development" })));
    expect(screen.getByRole("dialog", { name: "Planned activities for Development" })).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Planned activities for Development" })).toBeNull();

    await view.rerender(props);
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Open planned activities for Development" })));
    await fireEvent.click(requireValue(screen.getByRole("presentation")));
    expect(screen.queryByRole("dialog", { name: "Planned activities for Development" })).toBeNull();
  });

  it("adds separate structure and clipboard actions to weekly planned activities", async () => {
    const onUpdateActivity = vi.fn();
    const onDeleteActivity = vi.fn();
    const onMoveActivity = vi.fn();
    render(PlanSection, {...planProps(),
      plan: [{subjects:[],
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

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Open planned activities for Development" })));
    await fireEvent.contextMenu(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "First planned" }).closest<HTMLElement>(".planned-activity")));
    expect(screen.getByRole("menu", { name: "Planned activity actions" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Copy" })).toBeNull();
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Move Down" })));
    expect(onMoveActivity).toHaveBeenCalledWith("p1", "a1", "down");

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "First planned" })));
    const input = screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("Planned activity");
    input.setSelectionRange(0, 5);
    await fireEvent.contextMenu(requireValue(input));
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Cut" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Delete" })).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Planned activity actions" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Planned activities for Development" })).toBeTruthy();

    await fireEvent.contextMenu(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Second planned" }).closest<HTMLElement>(".planned-activity")));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Delete" })));
    expect(onDeleteActivity).toHaveBeenCalledWith("p1", "a2");
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Planned activities for Development" })).toBeNull();
  });

  it("opens weekly actual read-only details and closes the modal", async () => {
    render(ActualSection, {...actualProps(),
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

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Open actual activities for Development" })));

    expect(screen.getByRole("dialog", { name: "Actual activities for Development" })).toBeTruthy();
    expect(screen.getByText("Mon / 90m / 2 activities")).toBeTruthy();
    expect(screen.getByText("Draft tests")).toBeTruthy();
    expect(screen.getByText("Review parser")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add activity" })).toBeNull();

    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Actual activities for Development" })).toBeNull();

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Open actual activities for Development" })));
    await fireEvent.click(requireValue(screen.getByRole("presentation")));
    expect(screen.queryByRole("dialog", { name: "Actual activities for Development" })).toBeNull();
  });

  it("marks Weekly Actual card and detail totals as incomplete", async () => {
    render(ActualSection, {...actualProps(),
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

    const actualCard = screen.getByRole<HTMLButtonElement>("button", { name: "Open actual activities for Development" });
    expect(within(requireValue(actualCard)).getByText("30m+")).toBeTruthy();
    await fireEvent.click(requireValue(actualCard));
    expect(screen.getByText("Mon / 30m+ / 2 activities")).toBeTruthy();
    expect(screen.getByText("?")).toBeTruthy();
  });

  it("shows the mixed Weekly Planned section total", () => {
    render(PlanSection, {...planProps(),
      plan: [{subjects:[],
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
    render(ActualSection, {...actualProps(),
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

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Add session" })));
    expect(screen.getByRole("option", { name: "Deep Work" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Deep Work" }).querySelector<HTMLElement>(".planned-marker")?.textContent).toBe("*");
    expect(screen.getByRole("option", { name: "Deep Work" }).querySelector<HTMLElement>(".planned-marker")?.textContent).toBe("*");
    expect(screen.getByRole("option", { name: "Long planned session name that should be visible on hover" }).getAttribute("title")).toBe("Long planned session name that should be visible on hover");
    expect(screen.queryByRole("option", { name: "Review" })).toBeNull();

    await fireEvent.input(requireValue(screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("Session name...")), { target: { value: "long" } });
    expect(screen.queryByRole("option", { name: "Deep Work" })).toBeNull();
    expect(screen.getByRole("option", { name: "Long planned session name that should be visible on hover" })).toBeTruthy();
  });

  it("preserves suggestion casing for exact typed session matches", async () => {
    const onAdd = vi.fn(() => true);
    render(AddSessionForm, { suggestions: [{ name: "Deep Work", plannedThisWeek: true }], existingSessions: [], onAdd });

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Add session" })));
    await fireEvent.input(requireValue(screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("Session name...")), { target: { value: "deep work" } });
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Add" })));

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

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Add session" })));
    const options = screen.getAllByRole("option").map((option) => option.textContent);

    expect(options).toEqual(["*Alpha", "*beta", "Gamma"]);
  });

  it("does not show a suggestions dropdown when no suggestions are available", async () => {
    render(AddSessionForm, { suggestions: [], existingSessions: [], onAdd: vi.fn(() => true) });

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Add session" })));

    expect(screen.queryByRole("option")).toBeNull();
  });

  it("edits objective status and subjects without an origin control", async () => {
    const onUpdate = vi.fn();
    render(ObjectiveRow, {...objectiveProps(),
      objective: {id:"fixture-objective", subjects: ["rust"], status: "open" as const, description: "Ship", indent: 0 },
      onUpdate, onDelete: vi.fn()
    });
    expect(document.querySelector<HTMLElement>(".origin-badge")).toBeNull();

    await fireEvent.click(requireValue(screen.getByLabelText("Status")));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Partial" })));

    expect(onUpdate).toHaveBeenCalledWith({ status: "partial" as const });

    await fireEvent.input(requireValue(screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" })), { target: { value: "weekly" } });
    await fireEvent.keyDown(requireValue(screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" })), { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith({ subjects: ["rust", "weekly"] });
  });

  it("renders objective indentation and uses Tab and Shift+Tab without leaving the editor", async () => {
    const onIndent = vi.fn();
    const onOutdent = vi.fn();
    const { container } = render(ObjectiveRow, {...objectiveProps(),
      objective: {id:"fixture-objective", subjects: ["rust"], status: "open" as const, description: "Nested", indent: 2 },
      onUpdate: vi.fn(), onDelete: vi.fn(), onIndent, onOutdent
    });

    expect(requireValue(container.querySelector<HTMLElement>(".objective-card")).style.marginLeft).toBe("48px");
    await fireEvent.click(requireValue(screen.getByText("Nested")));
    const input = screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("Objective description");
    expect(document.activeElement).toBe(input);

    expect(await fireEvent.keyDown(requireValue(input), { key: "Tab" })).toBe(false);
    expect(onIndent).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
    expect(await fireEvent.keyDown(requireValue(input), { key: "Tab", shiftKey: true })).toBe(false);
    expect(onOutdent).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
  });

  it("folds and unfolds indented objective rows", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    let foldedObjectiveIds: string[] = [];
    let rendered: { rerender(props: Partial<ComponentProps<typeof ObjectivesSection>>): Promise<void> } | undefined;
    const props = {
      objectives: [
        { id: "parent", subjects: ["general"], status: "open" as const, description: "Parent", indent: 0 },
        { id: "child", subjects: ["general"], status: "open" as const, description: "Child", indent: 1 },
        { id: "sibling", subjects: ["general"], status: "open" as const, description: "Sibling", indent: 0 }
      ],
      foldedObjectiveIds,
      onFoldChange: async (ids:string[]) => {
        foldedObjectiveIds = ids;
        await requireValue(rendered).rerender({ ...props, foldedObjectiveIds });
      },
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    };
    rendered = render(ObjectivesSection, props);

    expect(screen.getByText("Child")).toBeTruthy();
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Collapse objective" })));
    expect(screen.queryByText("Child")).toBeNull();
    expect(screen.getByText("Sibling")).toBeTruthy();

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Expand objective" })));
    expect(screen.getByText("Child")).toBeTruthy();
  });

  it("preserves objective folds when the weekly panel remounts", async () => {
    weekStore.path = "A.md";
    weekStore.loaded = true;
    weekStore.descriptor = { year: 2026, week: 26, rangeLabel: "June 22-28" };
    weekStore.objectives = [
      { id: "parent", subjects: ["general"], status: "open" as const, description: "Parent", indent: 0 },
      { id: "child", subjects: ["general"], status: "open" as const, description: "Child", indent: 1 }
    ];
    weekStore.plan = [];
    weekStore.actual = [];

    const firstMount = render(WeekPanel);
    expect(screen.getByText("Child")).toBeTruthy();
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Collapse objective" })));
    expect(screen.queryByText("Child")).toBeNull();
    expect(weekStore.foldedObjectiveIds).toEqual(["parent"]);

    firstMount.unmount();
    render(WeekPanel);

    expect(screen.queryByText("Child")).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Expand objective" })).toBeTruthy();
  });

  it("offers single-objective structure actions from the context menu", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    const onIndent = vi.fn();
    const onOutdent = vi.fn();
    const onMove = vi.fn();
    const onDelete = vi.fn();
    render(ObjectivesSection, {
      objectives: [
        { id: "first", subjects: [], status: "open" as const, description: "First", indent: 0 },
        { id: "target", subjects: [], status: "open" as const, description: "Target", indent: 1 },
        { id: "last", subjects: [], status: "open" as const, description: "Last", indent: 0 }
      ],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete, onMove, onIndent, onOutdent
    });

    const targetRow = requireValue(screen.getByText("Target").closest<HTMLElement>("article"));
    await fireEvent.contextMenu(requireValue(targetRow), { clientX: 40, clientY: 50 });
    expect(screen.getByRole("menu", { name: "Objective actions" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Copy" })).toBeNull();
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Indent" })));
    expect(onIndent).toHaveBeenCalledWith("target");
    expect(screen.queryByRole("menu", { name: "Objective actions" })).toBeNull();

    await fireEvent.contextMenu(requireValue(targetRow));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Outdent" })));
    expect(onOutdent).toHaveBeenCalledWith("target");

    await fireEvent.contextMenu(requireValue(targetRow));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Move Up" })));
    expect(onMove).toHaveBeenCalledWith("target", "up");

    await fireEvent.contextMenu(requireValue(targetRow));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Move Down" })));
    expect(onMove).toHaveBeenCalledWith("target", "down");

    await fireEvent.contextMenu(requireValue(targetRow));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Delete" })));
    expect(onDelete).toHaveBeenCalledWith("target");
  });

  it("collapses and expands all foldable objectives from the context menu", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    let foldedObjectiveIds: string[] = [];
    let rendered: { rerender(props: Partial<ComponentProps<typeof ObjectivesSection>>): Promise<void> } | undefined;
    const props = {
      objectives: [
        { id: "parent", subjects: [], status: "open" as const, description: "Parent", indent: 0 },
        { id: "child", subjects: [], status: "open" as const, description: "Child", indent: 1 },
        { id: "grandchild", subjects: [], status: "open" as const, description: "Grandchild", indent: 2 },
        { id: "sibling", subjects: [], status: "open" as const, description: "Sibling", indent: 0 }
      ],
      foldedObjectiveIds,
      onFoldChange: async (ids: string[]) => {
        foldedObjectiveIds = ids;
        await requireValue(rendered).rerender({ ...props, foldedObjectiveIds });
      },
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    };
    rendered = render(ObjectivesSection, props);

    await fireEvent.contextMenu(requireValue(screen.getByText("Parent").closest<HTMLElement>("article")));
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Collapse All Objectives" }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Expand All Objectives" }).disabled).toBe(true);
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Collapse All Objectives" })));

    expect(foldedObjectiveIds).toEqual(["parent", "child"]);
    expect(screen.queryByText("Child")).toBeNull();
    expect(screen.queryByRole("menu", { name: "Objective actions" })).toBeNull();

    await fireEvent.contextMenu(requireValue(screen.getByText("Parent").closest<HTMLElement>("article")));
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Collapse All Objectives" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Expand All Objectives" }).disabled).toBe(false);
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Expand All Objectives" })));

    expect(foldedObjectiveIds).toEqual([]);
    expect(screen.getByText("Child")).toBeTruthy();
    expect(screen.getByText("Grandchild")).toBeTruthy();
  });

  it("disables unavailable objective context actions and closes with Escape", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    render(ObjectivesSection, {
      objectives: [{ id: "only", subjects: [], status: "open" as const, description: "Only", indent: 0 }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    await fireEvent.contextMenu(requireValue(screen.getByText("Only").closest<HTMLElement>("article")));
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Outdent" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Move Up" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Move Down" }).disabled).toBe(true);
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Objective actions" })).toBeNull();
  });

  it("adds focus-preserving text actions to editable objective targets", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    render(ObjectivesSection, {
      objectives: [{ id: "objective", subjects: ["rust"], status: "open" as const, description: "Editable objective", indent: 0 }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    await fireEvent.click(requireValue(screen.getByText("Editable objective")));
    const description = screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("Objective description");
    description.setSelectionRange(0, 8);
    await fireEvent.contextMenu(requireValue(description));

    const cut = screen.getByRole<HTMLButtonElement>("menuitem", { name: "Cut" });
    const copy = screen.getByRole<HTMLButtonElement>("menuitem", { name: "Copy" });
    expect(cut.disabled).toBe(false);
    expect(copy.disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Paste" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Select All" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Delete" })).toBeTruthy();
    expect(await fireEvent.pointerDown(requireValue(copy))).toBe(false);
    expect(document.activeElement).toBe(description);
    expect(description.selectionStart).toBe(0);
    expect(description.selectionEnd).toBe(8);

    await fireEvent.keyDown(window, { key: "Escape" });
    description.setSelectionRange(3, 3);
    await fireEvent.contextMenu(requireValue(description));
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Cut" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Copy" }).disabled).toBe(true);
    await fireEvent.keyDown(window, { key: "Escape" });

    const subjectInput = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox", { name: "Add subject" });
    await fireEvent.contextMenu(requireValue(subjectInput));
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Paste" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Indent" })).toBeTruthy();
    vi.mocked(readText).mockRejectedValueOnce(new Error("denied"));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Paste" })));
    await vi.waitFor(() => expect(appStore.statusMessage).toContain("Clipboard failed: Error: denied"));
  });

  it("selects all text in the active objective editor from its context menu", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    render(ObjectivesSection, {
      objectives: [{ id: "objective", subjects: [], status: "open" as const, description: "Select this objective", indent: 0 }],
      onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    await fireEvent.click(requireValue(screen.getByText("Select this objective")));
    const description = screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("Objective description");
    description.setSelectionRange(4, 4);
    await fireEvent.contextMenu(requireValue(description));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Select All" })));

    expect(document.activeElement).toBe(description);
    expect(description.selectionStart).toBe(0);
    expect(description.selectionEnd).toBe(description.value.length);
    expect(screen.queryByRole("menu", { name: "Objective actions" })).toBeNull();
  });

  it("routes objective Cut and Paste through existing input updates", async () => {
    const { default: ObjectivesSection } = await import("$lib/features/weekly/components/ObjectivesSection.svelte");
    const onUpdate = vi.fn();
    render(ObjectivesSection, {
      objectives: [{ id: "objective", subjects: ["rust"], status: "open" as const, description: "Editable objective", indent: 0 }],
      onAdd: vi.fn(), onUpdate, onDelete: vi.fn(), onMove: vi.fn(), onIndent: vi.fn(), onOutdent: vi.fn()
    });

    await fireEvent.click(requireValue(screen.getByText("Editable objective")));
    const description = screen.getByPlaceholderText<HTMLInputElement | HTMLTextAreaElement>("Objective description");
    description.setSelectionRange(0, 8);
    await fireEvent.contextMenu(requireValue(description));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Cut" })));
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith("objective", { description: " objective" }));
    expect(writeText).toHaveBeenCalledWith("Editable");

    vi.mocked(readText).mockResolvedValueOnce("Updated");
    description.setSelectionRange(0, 0);
    await fireEvent.contextMenu(requireValue(description));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("menuitem", { name: "Paste" })));
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith("objective", { description: "Updated objective" }));
  });

  it("emits Weekly objective move actions", async () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    render(ObjectiveRow, {...objectiveProps(),
      objective: {id:"fixture-objective", subjects: ["rust"], status: "open" as const, description: "Move objective", indent: 0 },
      canMoveUp: true,
      canMoveDown: true,
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onMoveUp,
      onMoveDown
    });

    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Move objective up" })));
    await fireEvent.click(requireValue(screen.getByRole<HTMLButtonElement>("button", { name: "Move objective down" })));

    expect(onMoveUp).toHaveBeenCalledOnce();
    expect(onMoveDown).toHaveBeenCalledOnce();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Delete objective" })).toBeTruthy();
  });
});
