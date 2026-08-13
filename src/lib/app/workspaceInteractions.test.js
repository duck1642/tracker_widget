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

describe("unavailable logs folder", () => {
  it("offers locate, select, and retry actions", async () => {
    workspaceStore.unavailable = true;
    const chooseRoot = vi.spyOn(workspaceStore, "chooseRoot").mockResolvedValue(true);
    const refresh = vi.spyOn(workspaceStore, "refresh").mockResolvedValue(true);
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn(), onClose: vi.fn() });
    const recovery = screen.getByText("Workspace unavailable").parentElement;
    await fireEvent.click(within(recovery).getByRole("button", { name: "Locate existing" }));
    await fireEvent.click(within(recovery).getByRole("button", { name: "Select new" }));
    await fireEvent.click(within(recovery).getByRole("button", { name: "Retry" }));
    expect(chooseRoot).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe("sidebar sorting", () => {
  it("opens the Week Files menu and runs the current-week shortcut", async () => {
    const createCurrentWeekFiles = vi.spyOn(workspaceStore, "createCurrentWeekFiles").mockResolvedValue(true);
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });

    expect(screen.queryByRole("button", { name: "Select workspace folder" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Initialize current week/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Fill in missing files/ })).toBeNull();

    await fireEvent.click(screen.getByRole("button", { name: "Week files" }));
    expect(screen.getByRole("menu", { name: "Week files" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("menuitem", { name: "Current week — check/repair" }));

    expect(createCurrentWeekFiles).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu", { name: "Week files" })).toBeNull();
  });

  it("runs the next-week shortcut from the Week Files menu", async () => {
    const createNextWeekFiles = vi.spyOn(workspaceStore, "createNextWeekFiles").mockResolvedValue(true);
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });

    await fireEvent.click(screen.getByRole("button", { name: "Week files" }));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Next week — create" }));

    expect(createNextWeekFiles).toHaveBeenCalledOnce();
  });

  it("chooses and previews a consecutive ISO week range with app-styled controls", async () => {
    const createSelectedWeekFiles = vi.spyOn(workspaceStore, "createSelectedWeekFiles").mockResolvedValue(true);
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });

    await fireEvent.click(screen.getByRole("button", { name: "Week files" }));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Choose weeks…" }));

    expect(screen.getByRole("dialog", { name: "Choose weeks" })).toBeTruthy();
    const current = getWeekDescriptor(new Date());
    const nextDate = new Date(current.start);
    nextDate.setDate(nextDate.getDate() + 7);
    const next = getWeekDescriptor(nextDate);
    const followingDate = new Date(next.start);
    followingDate.setDate(followingDate.getDate() + 7);
    const following = getWeekDescriptor(followingDate);

    expect(screen.queryByRole("spinbutton")).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Next start week" }));
    await fireEvent.click(screen.getByRole("button", { name: "Increase number of weeks" }));

    expect(screen.getByLabelText(`${next.folderName} · ${next.rangeLabel}`)).toBeTruthy();
    expect(screen.getByLabelText(`${following.folderName} · ${following.rangeLabel}`)).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Check/repair 2 weeks" }));

    expect(createSelectedWeekFiles).toHaveBeenCalledWith(next.year, next.week, 2);
    expect(screen.queryByRole("dialog", { name: "Choose weeks" })).toBeNull();
  });

  it("opens a readable week calendar and selects a whole week", async () => {
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });
    await fireEvent.click(screen.getByRole("button", { name: "Week files" }));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Choose weeks…" }));

    const selected = getWeekDescriptor(new Date());
    await fireEvent.click(screen.getByRole("button", { name: /Choose start week/ }));

    expect(screen.getByRole("group", { name: "Choose start week" })).toBeTruthy();
    expect(screen.getByRole("button", {
      name: `Select Week ${selected.week}, ${selected.year}: ${selected.rangeLabel}`
    })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next month" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "This week" })).toBeTruthy();
  });

  it("dismisses the Week Files menu with Escape", async () => {
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });
    await fireEvent.click(screen.getByRole("button", { name: "Week files" }));
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Week files" })).toBeNull();
  });

  it("toggles between newest-first and oldest-first", async () => {
    workspaceStore.weeks = [
      { path: "new", name: "2026w25", indexPath: null, days: [] },
      { path: "old", name: "2025w52", indexPath: null, days: [] }
    ];
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });
    const labels = () => screen.getAllByRole("button", { name: /20\d\dw\d\d/ }).map((button) => button.textContent.trim());
    expect(labels()).toEqual(["2026w25", "2025w52"]);
    const sortButton = screen.getByRole("button", { name: "Week order: newest first — click for oldest first" });
    expect(sortButton.title).toBe("Week order: newest first — click for oldest first");
    await fireEvent.click(sortButton);
    expect(screen.getByRole("button", { name: "Week order: oldest first — click for newest first" }).title)
      .toBe("Week order: oldest first — click for newest first");
    expect(labels()).toEqual(["2025w52", "2026w25"]);
  });

  it("retains sorting and expansion state while hidden", async () => {
    const props = { open: true, selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() };
    workspaceStore.weeks = [
      { path: "new", name: "2026w25", indexPath: null, days: [] },
      { path: "old", name: "2025w52", indexPath: null, days: [] }
    ];
    const view = render(AppSidebar, props);
    const labels = () => screen.getAllByRole("button", { name: /20\d\dw\d\d/ }).map((button) => button.textContent.trim());
    await fireEvent.click(screen.getByRole("button", { name: /Week order:/ }));
    await fireEvent.click(screen.getByRole("button", { name: "2025w52" }));
    expect(labels()).toEqual(["2025w52", "2026w25"]);
    expect(screen.getByRole("button", { name: "2025w52" }).getAttribute("aria-expanded")).toBe("false");

    await view.rerender({ ...props, open: false });
    await view.rerender({ ...props, open: true });

    expect(labels()).toEqual(["2025w52", "2026w25"]);
    expect(screen.getByRole("button", { name: "2025w52" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("collapses and expands all week folders without disabling per-week toggles", async () => {
    workspaceStore.weeks = [
      { path: "week", name: "2026w25", indexPath: "week/index.md", days: [{ path: "week/day.md", date: "2026-06-22" }] }
    ];
    render(AppSidebar, { selectedPath: "", onSelectWeek: vi.fn(), onSelectDay: vi.fn() });

    expect(screen.getByText("Weekly index")).toBeTruthy();
    expect(screen.getByText("2026-06-22")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Collapse all weeks" }));
    expect(screen.queryByText("Weekly index")).toBeNull();
    expect(screen.queryByText("2026-06-22")).toBeNull();
    expect(screen.getByRole("button", { name: "2026w25" }).getAttribute("aria-expanded")).toBe("false");

    await fireEvent.click(screen.getByRole("button", { name: "Expand all weeks" }));
    expect(screen.getByText("Weekly index")).toBeTruthy();
    expect(screen.getByText("2026-06-22")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "2026w25" }));
    expect(screen.queryByText("Weekly index")).toBeNull();
    expect(screen.getByRole("button", { name: "2026w25" }).getAttribute("aria-expanded")).toBe("false");
  });

});

describe("workspace settings and todo recovery", () => {
  it("shows derived Todo and Scratchpad file locations and statuses", () => {
    appStore.logsRootPath = "C:\\Tracker";
    appStore.filePath = "C:\\Tracker\\todo.md";
    workspaceStore.todoExists = false;
    workspaceStore.scratchpadExists = true;
    render(SettingsPanel, { dragEnabled: true, autostartEnabled: false, onToggleDrag: vi.fn(), onToggleAutostart: vi.fn() });

    expect(screen.getByText("Workspace folder")).toBeTruthy();
    expect(screen.queryByText("Todo document")).toBeNull();
    expect(screen.getByTitle("C:\\Tracker")).toBeTruthy();
    expect(screen.getByTitle("C:\\Tracker\\todo.md")).toBeTruthy();
    expect(screen.getByTitle("C:\\Tracker\\scratchpad.md")).toBeTruthy();
    expect(screen.getByText("Missing")).toBeTruthy();
    expect(screen.getByText("Found")).toBeTruthy();
  });

  it("rebuilds subject history from settings", async () => {
    appStore.logsRootPath = "C:\\Tracker";
    subjectHistoryStore.history = { subjects: { rust: { count: 1, last_used: "now" } } };
    const rebuild = vi.spyOn(subjectHistoryStore, "rebuild").mockResolvedValue(true);
    render(SettingsPanel, { dragEnabled: true, autostartEnabled: false, onToggleDrag: vi.fn(), onToggleAutostart: vi.fn() });

    expect(screen.getByText("Subject history")).toBeTruthy();
    expect(screen.getByText("1 subject")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Rebuild subject history/ }));

    expect(rebuild).toHaveBeenCalledWith("C:\\Tracker");
  });

  it("rebuilds session history from settings", async () => {
    appStore.logsRootPath = "C:\\Tracker";
    sessionHistoryStore.history = { sessions: { Work: { planned_count: 1, actual_count: 2, last_used: "now" } } };
    const rebuild = vi.spyOn(sessionHistoryStore, "rebuild").mockResolvedValue(true);
    render(SettingsPanel, { dragEnabled: true, autostartEnabled: false, onToggleDrag: vi.fn(), onToggleAutostart: vi.fn() });

    expect(screen.getByText("Session history")).toBeTruthy();
    expect(screen.getByText("1 session")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Rebuild session history/ }));

    expect(rebuild).toHaveBeenCalledWith("C:\\Tracker");
  });

  it("changes frontmatter mode from settings", async () => {
    appStore.frontmatterMode = "off";
    const changeFrontmatterMode = vi.spyOn(appStore, "changeFrontmatterMode").mockResolvedValue(undefined);
    render(SettingsPanel, { dragEnabled: true, autostartEnabled: false, onToggleDrag: vi.fn(), onToggleAutostart: vi.fn() });

    await fireEvent.click(screen.getByRole("button", { name: "Personal" }));

    expect(screen.getByText("Frontmatter")).toBeTruthy();
    expect(changeFrontmatterMode).toHaveBeenCalledWith("personal");
  });

  it("offers create and import when workspace todo is missing", () => {
    appStore.logsRootPath = "C:\\Tracker";
    appStore.filePath = "C:\\Tracker\\todo.md";
    workspaceStore.unavailable = false;
    workspaceStore.todoExists = false;
    todoStore.fileMissing = true;
    render(TodoPanel);

    expect(screen.getByText("No todo.md found")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create todo.md" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import Markdown" })).toBeTruthy();
  });

  it("passes frontmatter mode when creating week files", async () => {
    appStore.logsRootPath = "C:\\Tracker";
    appStore.frontmatterMode = "personal";
    const createWeek = vi.spyOn(logWorkspaceService, "createWeek").mockResolvedValue([]);
    vi.spyOn(workspaceStore, "refresh").mockResolvedValue(true);

    await workspaceStore.createCurrentWeekFiles();

    expect(createWeek).toHaveBeenCalledWith("C:\\Tracker", expect.any(Date), "personal");
  });
});

describe("NotesEditor interactions", () => {
  async function renderNotes(props) {
    const { default: NotesEditor } = await import("$lib/shared/components/NotesEditor.svelte");
    const result = render(NotesEditor, props);
    await tick();
    const textbox = screen.getByRole("textbox", { name: props.label ?? "Notes" });
    const view = EditorView.findFromDOM(textbox);
    if (!view) throw new Error("CodeMirror editor was not mounted");
    return { ...result, textbox, view };
  }

  it("styles all heading levels inside one continuous editor", async () => {
    const { container } = await renderNotes({
      value: "# One\n## Two\n### Three\n#### Four\n##### Five\n###### Six",
      onChange: vi.fn()
    });

    for (let level = 1; level <= 6; level += 1) {
      expect(container.querySelector(`.cm-note-heading-${level}`)).toBeTruthy();
    }
    expect(container.querySelectorAll('[role="textbox"]')).toHaveLength(1);
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("uses native text selection so wrapped highlights follow their glyphs", async () => {
    const { container } = await renderNotes({
      value: "a-very-long-wrapped-note-selection",
      onChange: vi.fn()
    });

    expect(container.querySelector(".cm-selectionLayer")).toBeNull();
  });

  it("switches between live preview and Markdown source without changing editor state", async () => {
    const value = "# Heading\n\n- [ ] task\n\n**bold**";
    const onChange = vi.fn();
    const { container, view } = await renderNotes({ value, onChange });
    view.dispatch({ selection: { anchor: value.indexOf("task") + 2 } });

    expect(container.querySelector(".cm-note-heading")).toBeTruthy();
    expect(container.querySelector(".cm-note-task")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Show Markdown source" }));

    expect(container.querySelector(".notes-surface").classList.contains("source-view")).toBe(true);
    expect(container.querySelector(".cm-note-heading")).toBeNull();
    expect(container.querySelector(".cm-note-task")).toBeNull();
    expect(view.state.doc.toString()).toBe(value);
    expect(view.state.selection.main.head).toBe(value.indexOf("task") + 2);
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole("button", { name: "Show live preview" }));

    expect(container.querySelector(".notes-surface").classList.contains("source-view")).toBe(false);
    expect(container.querySelector(".cm-note-heading")).toBeTruthy();
    expect(container.querySelector(".cm-note-task")).toBeTruthy();
    expect(view.state.doc.toString()).toBe(value);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders task and bullet widgets and shows help on hover", async () => {
    const { container } = await renderNotes({
      value: "- [ ] Buy milk\n- todo 2\n  - nested todo\n---\n**bold** *italic* `code` [link](https://example.com)",
      onChange: vi.fn(),
      label: "Daily Notes"
    });

    expect(container.querySelector(".cm-note-task")).toBeTruthy();
    const bulletMarkers = Array.from(container.querySelectorAll(".cm-note-list-marker"));
    expect(bulletMarkers.every((marker) => marker.classList.contains("cm-note-list-marker-unordered"))).toBe(true);
    expect(bulletMarkers.map((marker) => marker.textContent)).toEqual(["•", "•"]);
    expect(bulletMarkers.map((marker) => getComputedStyle(marker).width)).toEqual(["0.75em", "0.75em"]);
    expect(bulletMarkers.map((marker) => getComputedStyle(marker).marginRight)).toEqual(["6px", "6px"]);
    expect(bulletMarkers.map((marker) => getComputedStyle(marker).textIndent)).toEqual(["0px", "0px"]);
    expect(container.querySelector(".cm-note-rule")).toBeTruthy();
    expect(container.querySelector(".cm-note-strong")).toBeTruthy();
    expect(container.querySelector(".cm-note-emphasis")).toBeTruthy();
    expect(container.querySelector(".cm-note-inline-code")).toBeTruthy();
    expect(container.querySelector(".cm-note-link")?.textContent).toBe("link");
    expect(container.textContent).toContain("Buy milk");
    expect(container.textContent).toContain("todo 2");

    const helpBtn = screen.getByRole("button", { name: "Formatting help" });
    await fireEvent.mouseEnter(helpBtn.parentElement);
    expect(screen.getByText("Formatting Guide")).toBeTruthy();
  });

  it("keeps the current list line rendered while typing", async () => {
    const { container, view } = await renderNotes({
      value: "- first\n- current\n- last",
      onChange: vi.fn()
    });
    view.focus();
    view.dispatch({ selection: { anchor: "- first\n- current".length } });
    await tick();

    expect(Array.from(container.querySelectorAll(".cm-note-list-marker"), (marker) => marker.textContent)).toEqual(["•", "•", "•"]);
    expect(container.querySelector(".cm-line:nth-child(2)")?.textContent).not.toContain("- current");
  });

  it("keeps two-space nested lists on a stable hanging-indent grid", async () => {
    const value = "4. parent\n  5. sadas\n  6. sda\n    7. asda\n    8. asdas";
    const { container, view } = await renderNotes({ value, onChange: vi.fn() });
    const lines = Array.from(container.querySelectorAll(".cm-note-list-layout"));
    const markers = Array.from(container.querySelectorAll(".cm-note-list-marker"));

    expect(lines).toHaveLength(5);
    expect(markers.map((marker) => marker.textContent)).toEqual(["1.", "1.", "2.", "1.", "2."]);
    expect(markers.every((marker) => marker.className === "cm-note-list-marker cm-note-list-marker-ordered")).toBe(true);
    expect(lines.map((line) => line.style.getPropertyValue("--cm-note-list-depth"))).toEqual([
      "0px",
      "calc(16px + 1.05em)",
      "calc(16px + 1.05em)",
      "calc(16px + 1.05em + 16px + 1.05em)",
      "calc(16px + 1.05em + 16px + 1.05em)"
    ]);
    expect(lines.map((line) => line.style.getPropertyValue("--cm-note-list-prefix"))).toEqual(
      Array(5).fill("calc(1.2em + 6px)")
    );
    expect(lines.map((line) => (line.getAttribute("style")?.match(/linear-gradient/g) ?? []).length)).toEqual([0, 1, 1, 2, 2]);
    expect(lines.map((line) => line.style.backgroundPosition)).toEqual([
      "",
      "calc(0.525em) 0px",
      "calc(0.525em) 0px",
      "calc(0.525em) 0px, calc(0.525em + 1.05em + 16px) 0px",
      "calc(0.525em) 0px, calc(0.525em + 1.05em + 16px) 0px"
    ]);
    expect(lines.slice(1).every((line) => line.style.backgroundSize.split(", ").every((size) => size === "1px 100%"))).toBe(true);
    expect(lines.slice(1).every((line) => line.style.backgroundRepeat.split(", ").every((repeat) => repeat === "no-repeat"))).toBe(true);
    expect(lines.every((line) => line.style.paddingLeft === "calc(var(--cm-note-list-depth) + var(--cm-note-list-prefix))")).toBe(true);
    expect(lines.every((line) => line.style.textIndent === "calc(-1 * var(--cm-note-list-prefix))")).toBe(true);
    expect(view.state.doc.toString()).toBe(value);
  });

  it("keeps guide columns global across bullet and ordered list parents", async () => {
    const value = "- bullet parent\n  - bullet child\n\n1. ordered parent\n  - ordered child";
    const { container } = await renderNotes({ value, onChange: vi.fn() });
    const lines = Array.from(container.querySelectorAll(".cm-note-list-layout"));

    expect(lines).toHaveLength(4);
    expect(lines[1].style.backgroundPosition).toBe("calc(0.525em) 0px");
    expect(lines[3].style.backgroundPosition).toBe(lines[1].style.backgroundPosition);
  });

  it("uses narrower bullet prefixes than ordered-list prefixes", async () => {
    const { container } = await renderNotes({ value: "- bullet\n1. ordered", onChange: vi.fn() });
    const markers = Array.from(container.querySelectorAll(".cm-note-list-marker"));
    const lines = Array.from(container.querySelectorAll(".cm-note-list-layout"));

    expect(markers.map((marker) => marker.className)).toEqual([
      "cm-note-list-marker cm-note-list-marker-unordered",
      "cm-note-list-marker cm-note-list-marker-ordered"
    ]);
    expect(markers.map((marker) => getComputedStyle(marker).width)).toEqual(["0.75em", "1.2em"]);
    expect(markers.map((marker) => getComputedStyle(marker).transform)).toEqual(["translateX(.15em)", "translateX(.525em)"]);
    expect(markers.map((marker) => getComputedStyle(marker).textIndent)).toEqual(["0px", "0px"]);
    expect(lines.map((line) => line.style.getPropertyValue("--cm-note-list-prefix"))).toEqual([
      "calc(.75em + 6px)",
      "calc(1.2em + 6px)"
    ]);
  });

  it("updates the canonical Markdown when clicking a task widget", async () => {
    const onChange = vi.fn();
    const { view } = await renderNotes({ value: "- [ ] Todo item\n* List item", onChange });

    view.focus();
    view.dispatch({ selection: { anchor: 8 } });
    const taskButton = screen.getByRole("checkbox", { name: "Mark task complete" });
    expect(taskButton.tagName).toBe("BUTTON");
    expect(taskButton.querySelector("svg").style.visibility).toBe("hidden");

    await fireEvent.click(taskButton);
    expect(onChange).toHaveBeenLastCalledWith("- [x] Todo item\n* List item");
    const checkedButton = screen.getByRole("checkbox", { name: "Mark task incomplete" });
    expect(checkedButton.classList.contains("checked")).toBe(true);
    const checkIcon = checkedButton.querySelector("svg");
    expect(checkIcon).toBeTruthy();
    expect(checkIcon.style.visibility).toBe("");
    expect(checkIcon.getAttribute("width")).toBe("10");
    expect(checkIcon.getAttribute("height")).toBe("10");
    expect(checkIcon.getAttribute("stroke-width")).toBe("3");
  });

  it("emits the complete continuous document for an editor transaction", async () => {
    const onChange = vi.fn();
    const { view } = await renderNotes({ value: "Before\n**Current**\nAfter", onChange });
    const from = view.state.doc.toString().indexOf("Current");

    view.dispatch({ changes: { from, to: from + 7, insert: "Updated" } });

    expect(view.state.doc.toString()).toBe("Before\n**Updated**\nAfter");
    expect(onChange).toHaveBeenLastCalledWith("Before\n**Updated**\nAfter");
  });

  it("does not renumber ordered lists during an ordinary text edit", async () => {
    const value = "3. first\n9. intentional restart\nOutside";
    const onChange = vi.fn();
    const { view } = await renderNotes({ value, onChange });

    view.dispatch({ changes: { from: value.length, insert: "!" } });

    expect(view.state.doc.toString()).toBe(`${value}!`);
    expect(onChange).toHaveBeenLastCalledWith(`${value}!`);
  });

  it("continues Markdown lists on Enter and exits an empty list item", async () => {
    const onChange = vi.fn();
    const { textbox, view } = await renderNotes({ value: "", onChange });
    const cases = [
      ["- item", "- item\n- "],
      ["  - nested", "  - nested\n  - "],
      ["1. item", "1. item\n2. "],
      ["9) item", "9) item\n10) "],
      ["- [x] task", "- [x] task\n- [ ] "],
      ["- Intro\n\n- [ ] first\n- [ ] second", "- Intro\n\n- [ ] first\n- [ ] second\n- [ ] "],
      ["- item\n- ", "- item\n"]
    ];

    for (const [before, after] of cases) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: before },
        selection: { anchor: before.length }
      });
      await fireEvent.keyDown(textbox, { key: "Enter", code: "Enter" });
      expect(view.state.doc.toString()).toBe(after);
    }
  });

  it.each(["x", "xx", "xxx", "xxxx", "normal text"])("keeps ordinary text after exiting an ordered list: %s", async (text) => {
    const { textbox, view } = await renderNotes({ value: "3. item", onChange: vi.fn() });
    view.dispatch({ selection: { anchor: view.state.doc.length } });

    await fireEvent.keyDown(textbox, { key: "Enter", code: "Enter" });
    await fireEvent.keyDown(textbox, { key: "Enter", code: "Enter" });

    view.dispatch({
      changes: { from: view.state.selection.main.head, insert: text },
      selection: { anchor: view.state.selection.main.head + text.length }
    });
    await fireEvent.keyDown(textbox, { key: "Enter", code: "Enter" });

    expect(view.state.doc.toString()).toBe(`3. item\n${text}\n`);
  });

  it("preserves a five-backtick fenced block and reveals its exact source when active", async () => {
    const value = "Before\n`````js\n```inner```\nconst value = 1;\n`````\nAfter";
    const { container, view } = await renderNotes({ value, onChange: vi.fn() });

    expect(container.querySelectorAll(".cm-note-codeblock")).toHaveLength(4);
    expect(container.querySelector(".cm-note-codeblock-first")).toBeTruthy();
    expect(container.querySelector(".cm-note-codeblock-last")).toBeTruthy();
    expect(view.state.doc.toString()).toBe(value);

    const anchor = value.indexOf("inner");
    view.focus();
    view.dispatch({ selection: { anchor } });
    expect(container.textContent).toContain("`````js");
    expect(container.textContent).toContain("`````");
    expect(view.state.doc.toString()).toBe(value);
  });

  it("offers cut, copy, and paste through the shared context menu adapter", async () => {
    const onChange = vi.fn();
    const { textbox, view } = await renderNotes({ value: "Alpha text", onChange, label: "Weekly notes" });

    view.dispatch({ selection: { anchor: 6, head: 10 } });
    await fireEvent.contextMenu(textbox, { clientX: 20, clientY: 30 });

    const menu = screen.getByRole("menu", { name: "Notes text actions" });
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent.trim())).toEqual(["Cut", "Copy", "Paste"]);
    expect(within(menu).queryByText("Select All")).toBeNull();

    await fireEvent.click(within(menu).getByRole("menuitem", { name: "Cut" }));
    expect(writeText).toHaveBeenCalledWith("text");
    expect(onChange).toHaveBeenLastCalledWith("Alpha ");

    readText.mockResolvedValue("notes");
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    await fireEvent.contextMenu(textbox, { clientX: 20, clientY: 30 });
    await fireEvent.click(screen.getByRole("menuitem", { name: "Paste" }));
    expect(onChange).toHaveBeenLastCalledWith("Alpha notes");
  });

  it("synchronizes a real external value without echoing it through onChange", async () => {
    const onChange = vi.fn();
    const rendered = await renderNotes({ value: "alpha", onChange });
    rendered.view.dispatch({ selection: { anchor: 3 } });

    await rendered.rerender({ value: "a much longer external value", onChange });
    await tick();

    expect(rendered.view.state.doc.toString()).toBe("a much longer external value");
    expect(rendered.view.state.selection.main.head).toBe(3);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("mounts fold gutter only when folding prop is enabled", async () => {
    const withoutFolding = await renderNotes({ value: "# Header\nContent", onChange: vi.fn() });
    expect(withoutFolding.container.querySelector(".cm-foldGutter")).toBeNull();

    cleanup();

    const withFolding = await renderNotes({
      value: "# Header\nContent",
      onChange: vi.fn(),
      folding: true,
      filePath: "C:/test/scratchpad.md"
    });
    const foldGutter = withFolding.container.querySelector(".cm-foldGutter");
    const content = withFolding.container.querySelector(".cm-content");
    expect(foldGutter).toBeTruthy();
    const marker = withFolding.container.querySelector(".cm-fold-marker");
    const markerIcon = marker?.querySelector("svg");
    expect(marker).toBeTruthy();
    expect(getComputedStyle(foldGutter).width).toBe("24px");
    expect(getComputedStyle(content).paddingLeft).toBe("0px");
    expect(getComputedStyle(content).paddingRight).toBe("24px");
    expect(getComputedStyle(marker).width).toBe("16px");
    expect(getComputedStyle(marker).height).toBe("20px");
    expect(getComputedStyle(marker).marginLeft).toBe("8px");
    expect(getComputedStyle(marker).transform).toBe("none");
    expect(markerIcon?.getAttribute("width")).toBe("13");
    expect(markerIcon?.getAttribute("height")).toBe("13");

    await fireEvent.click(marker);
    await tick();

    const placeholder = withFolding.container.querySelector(".cm-foldPlaceholder");
    expect(placeholder?.textContent).toBe("...");
    expect(placeholder?.getAttribute("aria-label")).toBeTruthy();
    expect(getComputedStyle(placeholder).borderTopWidth).toBe("0px");
    expect(getComputedStyle(placeholder).backgroundColor).toBe("rgba(0, 0, 0, 0)");

    await fireEvent.click(placeholder);
    await tick();
    expect(withFolding.container.querySelector(".cm-foldPlaceholder")).toBeNull();
  });

  it("preserves Scratchpad fold state across unmount and remount during session", async () => {
    const filePath = "C:/test/session_scratchpad.md";
    const value = "# Parent\nChild content\n# Sibling\nOther content";

    const firstMount = await renderNotes({
      value,
      onChange: vi.fn(),
      folding: true,
      filePath
    });

    const { getFoldSnapshot, foldEffect } = await import("$lib/shared/editor/noteFolding.js");
    // Fold # Parent
    firstMount.view.dispatch({ effects: [foldEffect.of({ from: 8, to: 22 })] });
    expect(getFoldSnapshot(firstMount.view)).toEqual([{ from: 8, to: 22 }]);

    cleanup();
    await tick();

    // Re-mount identical Scratchpad (e.g. returning to tab)
    const secondMount = await renderNotes({
      value,
      onChange: vi.fn(),
      folding: true,
      filePath
    });

    expect(getFoldSnapshot(secondMount.view)).toEqual([{ from: 8, to: 22 }]);
    expect(secondMount.view.state.doc.toString()).toBe(value);
  });

  it("places fold controls on nested list guides without changing Markdown", async () => {
    const value = [
      "1. root",
      "  1. child",
      "    1. grandchild",
      "      1. great-grandchild",
      "2. sibling"
    ].join("\n");
    const rendered = await renderNotes({
      value,
      onChange: vi.fn(),
      folding: true,
      filePath: "C:/test/nested-folds.md"
    });

    const controls = rendered.container.querySelectorAll(".cm-note-list-fold-control");
    expect(controls).toHaveLength(2);
    const childControl = controls[0];
    expect(childControl.getAttribute("aria-label")).toBe("Fold list");
    expect(childControl.style.left).toBe("-16px");
    expect(controls[1].style.left).toBe("-16px");
    expect(getComputedStyle(childControl).fontSize).toBe(getComputedStyle(childControl.closest(".cm-line")).fontSize);

    await fireEvent.click(childControl);
    await tick();

    const { getFoldSnapshot } = await import("$lib/shared/editor/noteFolding.js");
    expect(getFoldSnapshot(rendered.view)).toHaveLength(1);
    expect(rendered.container.querySelector(".cm-note-list-fold-control")?.getAttribute("aria-label")).toBe("Unfold list");
    expect(rendered.view.state.doc.toString()).toBe(value);
  });
});

describe("sidebar keyboard file navigation", () => {
  const weeks = () => [
    {
      path: "new", name: "2026w25", indexPath: "new/index.md",
      days: [
        { path: "new/1.md", date: "2026-06-22" },
        { path: "new/2.md", date: "2026-06-23" }
      ]
    },
    {
      path: "old", name: "2026w24", indexPath: "old/index.md",
      days: [{ path: "old/1.md", date: "2026-06-15" }]
    }
  ];

  it("navigates logical files across collapsed weeks in the active sort order", async () => {
    appStore.currentView = "day";
    workspaceStore.weeks = weeks();
    let selectedPath = "new/2.md";
    let view;
    const onSelectWeek = vi.fn(async (week) => {
      selectedPath = week.indexPath;
      await view.rerender({ open: true, selectedPath, onSelectWeek, onSelectDay });
    });
    const onSelectDay = vi.fn(async (day) => {
      selectedPath = day.path;
      await view.rerender({ open: true, selectedPath, onSelectWeek, onSelectDay });
    });
    view = render(AppSidebar, { open: true, selectedPath, onSelectWeek, onSelectDay });

    await fireEvent.click(screen.getByRole("button", { name: "Collapse all weeks" }));
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    await vi.waitFor(() => expect(onSelectWeek).toHaveBeenCalledWith(expect.objectContaining({ name: "2026w24" })));
    expect(screen.getByRole("button", { name: "2026w25" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "2026w24" }).getAttribute("aria-expanded")).toBe("false");

    selectedPath = "old/1.md";
    await view.rerender({ open: true, selectedPath, onSelectWeek, onSelectDay });
    await fireEvent.click(screen.getByRole("button", { name: /Week order:/ }));
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    await vi.waitFor(() => expect(onSelectWeek).toHaveBeenLastCalledWith(expect.objectContaining({ name: "2026w25" })));
  });

  it("moves in both directions, skips missing entries, and stops at boundaries", async () => {
    appStore.currentView = "day";
    workspaceStore.weeks = [{
      path: "week", name: "2026w25", indexPath: "week/index.md",
      days: [
        { path: "week/1.md", date: "2026-06-22" },
        { path: "week/3.md", date: "2026-06-24" }
      ]
    }];
    let selectedPath = "week/3.md";
    let view;
    const onSelectWeek = vi.fn(async (week) => {
      selectedPath = week.indexPath;
      await view.rerender({ selectedPath, onSelectWeek, onSelectDay });
    });
    const onSelectDay = vi.fn(async (day) => {
      selectedPath = day.path;
      await view.rerender({ selectedPath, onSelectWeek, onSelectDay });
    });
    view = render(AppSidebar, { selectedPath, onSelectWeek, onSelectDay });

    await fireEvent.keyDown(window, { key: "PageUp", ctrlKey: true });
    await vi.waitFor(() => expect(onSelectDay).toHaveBeenLastCalledWith(expect.objectContaining({ path: "week/1.md" }), expect.anything()));
    await fireEvent.keyDown(window, { key: "PageUp", ctrlKey: true });
    await vi.waitFor(() => expect(onSelectWeek).toHaveBeenCalledOnce());
    await fireEvent.keyDown(window, { key: "PageUp", ctrlKey: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSelectWeek).toHaveBeenCalledOnce();

    selectedPath = "week/3.md";
    await view.rerender({ selectedPath, onSelectWeek, onSelectDay });
    const dayCalls = onSelectDay.mock.calls.length;
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSelectDay).toHaveBeenCalledTimes(dayCalls);
  });

  it("suppresses navigation in Todo, Settings, dialogs, and menus", async () => {
    workspaceStore.weeks = weeks();
    const onSelectWeek = vi.fn();
    const onSelectDay = vi.fn();
    const view = render(AppSidebar, { selectedPath: "new/index.md", onSelectWeek, onSelectDay });

    appStore.currentView = "todo";
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    appStore.currentView = "week";
    await view.rerender({ selectedPath: "new/index.md", onSelectWeek, onSelectDay, keyboardNavigationEnabled: false });
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });

    await view.rerender({ selectedPath: "new/index.md", onSelectWeek, onSelectDay, keyboardNavigationEnabled: true });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    dialog.remove();
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    document.body.append(menu);
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    menu.remove();

    expect(onSelectWeek).not.toHaveBeenCalled();
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it("settles an active editor and serializes rapid repeated navigation", async () => {
    appStore.currentView = "week";
    workspaceStore.weeks = weeks();
    const input = document.createElement("input");
    let editSettled = false;
    input.addEventListener("blur", () => setTimeout(() => { editSettled = true; }, 150));
    document.body.append(input);
    input.focus();

    const resolvers = [];
    const onSelectWeek = vi.fn(() => new Promise((resolve) => resolvers.push(resolve)));
    const onSelectDay = vi.fn(() => new Promise((resolve) => resolvers.push(resolve)));
    render(AppSidebar, { selectedPath: "new/index.md", onSelectWeek, onSelectDay });

    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    await fireEvent.keyDown(window, { key: "PageDown", ctrlKey: true });
    await vi.waitFor(() => expect(onSelectDay).toHaveBeenCalledTimes(1));
    expect(editSettled).toBe(true);
    expect(onSelectDay.mock.calls[0][0].path).toBe("new/1.md");

    resolvers.shift()();
    await vi.waitFor(() => expect(onSelectDay).toHaveBeenCalledTimes(2));
    expect(onSelectDay.mock.calls[1][0].path).toBe("new/2.md");
    resolvers.shift()();
    await vi.waitFor(() => expect(onSelectWeek).toHaveBeenCalledTimes(1));
    expect(onSelectWeek.mock.calls[0][0].indexPath).toBe("old/index.md");
    resolvers.shift()();
  });
});
