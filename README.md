# Tracker Widget

A premium, transparent desktop productivity widget built with **Tauri v2**, **SvelteKit**, and **Rust**. It serves as a unified workspace for managing Checklists, Weekly Plans, Daily logs, and Markdown notes, with true desktop pinning integrations for Windows.

## Key Features

- 🖥️ **Window Layering & Widget Modes**:
  - **Always on Top (`top`)**: Floats the tracker above all active apps.
  - **Normal Window (`normal`)**: Behave like a standard window layout.
  - **Fake Widget (`desktop`)**: Keeps the window on the bottom of the stack and hides it from the taskbar.
  - **True Widget (`true-desktop`)**: *Windows Only.* Natively parents the borderless, transparent window directly to the desktop workspace (`WorkerW`/`Progman`) using Win32 API hooks in Rust, pinning it securely behind desktop icons.
- 📝 **Unified Productivity Views**:
  - **Tasks**: Hierarchical checklist with keyboard shortcuts, subtask support, undo/redo logs, and file backup.
  - **Weekly Planner**: Manage objectives, target schedules, and view actual activity aggregation.
  - **Daily Log**: Track session times, active subjects, descriptions, and take notes.
  - **Notes Editor**: Full markdown preview editor built into your workspace.
- 💾 **File-Backed Persistence**:
  - Automatic background saving with debouncing.
  - Live external modifications check (reloads cleanly without layout stutter).
  - Built-in conflict resolution (Keep Local vs. Reload External) on write/focus.

## Getting Started & User Guide

To get the most out of the Tracker Widget, follow this step-by-step workflow:

### 1. Initial Setup
* **Todo document**: Open **Settings** (gear icon in the top header) and click **Select** to choose your custom `todo.md` checklist file. If this file is ever missing (e.g. across synced computers with different drive letters), the Tasks tab will show an inline warning letting you relocate the file without silently auto-creating empty files.
* **Logger workspace**: Select a root directory for your logbook workspace. The widget will automatically organize weekly directories (e.g., `2026w26`), template configurations, and daily logs within this folder.

### 2. Checklist (Tasks Tab)
* **Creating Tasks**: Click the `+` button in the toolbar, or press `Enter` on any active row to insert a new task.
* **Hierarchy & Subtasks**:
  * Press `Tab` on a task to indent it (create a subtask).
  * Press `Shift + Tab` to outdent it.
* **Navigation & History**: Use `Arrow Up`/`Arrow Down` to navigate, `Backspace` on an empty task to delete it, and the **Undo/Redo** buttons in the bottom toolbar to roll back or repeat checklist changes.

### 3. Log Tracking (Day Tab)
* **Log Entries**: Click **+ Add session** to record activities. Enter the session name, subjects, and time spent.
* **Metadata Format**: Logs are stored as standard Markdown list items. The widget automatically parses inline metadata in curly braces:
  ```markdown
  - {subjects: (rust, ui), time: 120m} Refactored the settings panel layout.
  ```
* **Live Notes Editor**: Click inside the notes box to open the live-editing textarea. Press `Escape` or click outside to save and switch back to the rendered Markdown preview (which supports checkable markdown checkboxes, bold text, blockquotes, and code blocks).

### 4. Weekly Planning (Week Tab)
* **Objectives**: Define weekly goals, marking their origin (`planned`/`unplanned`) and status (done, partial, cancelled, open).
* **Weekly Plan**: Allocate target minutes to specific subjects on chosen days.
* **Weekly Actuals**: Click **Refresh** to automatically scan your daily logs for the active week, compile the total duration spent on each subject, and generate a side-by-side plan-vs-actual comparison table.

## Tech Stack

- **Frontend**: SvelteKit 2, Svelte 5 (Runes), Vite, CSS.
- **Backend/Native**: Rust, Tauri v2, Windows Win32 API.
- **Icons**: Lucide Svelte.

## Setup & Running

Ensure you have Rust and Node.js installed on your machine.

### Development Mode

Run the development server and the Tauri container:

```bash
npm run tauri dev
```

### Run Tests

Run Svelte component and store tests via Vitest:

```bash
npm run test
```

### Production Build

Build the static web client and compile the release binary:

```bash
npm run build
```
