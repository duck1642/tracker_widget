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
