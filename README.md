# Tracker Widget

Tracker Widget is a local-first desktop productivity app built with Tauri v2, SvelteKit, and Rust. It uses plain Markdown files for todos, weekly planning, daily logs, and notes.

Current version: `1.2.0`

## Features

- Single workspace folder setup.
- `todo.md` checklist at the workspace root.
- Weekly folders named like `2026w27`.
- Daily logs and weekly index files generated from templates.
- Todo folding, row numbers, keyboard reorder, multiselect, and context-menu actions.
- Send selected todos to today's activity, weekly objectives, or weekly planned activities.
- Daily sessions with activity tracking, subject pills, time pills, notes, and session suggestions.
- Weekly planning with editable planned activity details.
- Weekly actuals derived from daily logs, with read-only activity details.
- App-local subject and session history suggestions.
- Optional personal YAML frontmatter mode for newly created files.
- Portable zip release support.

## Workspace Layout

Normal use expects one workspace folder:

```text
workspace/
  todo.md
  2026w27/
    2026w27_index.md
    20260701_log.md
    20260702_log.md
```

Unknown files are ignored. Missing week files can be created from the sidebar. Missing `todo.md` can be created or imported from the Todo view.

## Getting Started

1. Open the app.
2. Select a workspace folder.
3. Create or import `todo.md` if needed.
4. Use **Create week files** from the sidebar to initialize the current week.

Workspace location is managed from Settings. The Todo path is derived as `<workspace>/todo.md`.

## Todo

- `Enter`: add a todo.
- `Tab` / `Shift + Tab`: indent or outdent.
- `Alt + ArrowUp` / `Alt + ArrowDown`: reorder the focused visible todo.
- Use the toolbar to show row numbers, fold/unfold, undo/redo, reload, and add todos.
- `Ctrl + click`: select multiple todos.
- `Shift + click`: select a visible range.
- Right-click selected todos for bulk actions and send-to actions.

## Daily Log

Daily logs contain sessions, activities, subjects, time, and notes.

Activity Markdown format:

```markdown
- {subjects: (rust, ui), time: 120m} Refactored the settings panel layout.
```

Session suggestions come from the current weekly plan first, then app-local session history.

## Weekly Planning

Weekly plan rows have stable IDs and editable activity details:

```markdown
| ID | Day | Session | Subjects | Target Minutes |
| --- | --- | --- | --- | ---: |
| p1 | Fri | Calc1 study | math, geometry | 180 |

## Weekly Plan Details

<!-- tracker:plan-details:start -->

### p1

- {subjects: (math), time: 30m} Solve examples

<!-- tracker:plan-details:end -->
```

Plan card subject and time summaries are derived from planned activities. Weekly actuals are derived from daily logs and remain read-only.

## Settings

- Workspace folder.
- Frontmatter mode: `Off` or `Personal`.
- Rebuild subject history.
- Rebuild session history.

History files are app-local and ignored by git:

- `subject-history.json`
- `session-history.json`

## Development

Install Node.js and Rust, then:

```bash
npm install
npm run tauri dev
```

Run checks:

```bash
npm run test
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

## Build

Build the frontend only:

```bash
npm run build
```

Build the Tauri release:

```bash
npm run tauri build
```

Build the portable zip:

```bash
npm run package:portable
```

The portable zip is written to `build-artifacts/tracker-widget-portable-v1.2.0.zip`.
