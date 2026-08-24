# Tracker Widget

A local-first desktop app for planning your weeks, tracking daily activities, and keeping personal notes in plain Markdown files.

Tracker brings todos, weekly plans, daily logs, and notes into one workspace while keeping your data portable and under your control.

Built with Tauri, SvelteKit, and Rust.

Current version: `1.4.0`

## Features

- Single workspace folder setup.
- `todo.md` checklist at the workspace root.
- Global `scratchpad.md` with live Markdown preview and source editing.
- Weekly folders named like `2026w27`.
- Daily logs and weekly index files generated from templates.
- Todo folding, row numbers, keyboard reorder, multiselect, and context-menu actions.
- Send selected todos to today's activity, weekly objectives, or weekly planned activities.
- Daily sessions with activity tracking, subject pills, time pills, notes, and session suggestions.
- Weekly planning with editable planned activity details, duplicate cards, duration totals, and collapsible day columns.
- Weekly actuals derived from daily logs, with read-only activity details and duration totals.
- Indented and foldable weekly objectives stored as nested Markdown lists, with session-wide fold memory and bulk fold actions.
- Back/Forward history and keyboard navigation between weekly and daily log files.
- Custom text and entity context menus throughout the app.
- App-local subject and session history suggestions.
- Optional personal YAML frontmatter mode for newly created files.
- Safe week checking, Personal conversion, and Recycle Bin deletion from the sidebar.
- Single-instance launch behavior: opening Tracker Widget again restores and focuses the existing window.
- Portable zip release support.

## Workspace Layout

Normal use expects one workspace folder:

```text
workspace/
  todo.md
  scratchpad.md
  2026w27/
    2026w27_index.md
    20260701_log.md
    20260702_log.md
```

Unknown files are ignored. Missing week files can be checked or created for explicit week ranges from the sidebar. Missing `todo.md` can be created or imported from the Todo view. `scratchpad.md` is created lazily when Scratchpad is first opened.

## Getting Started

1. Open the app.
2. Select a workspace folder.
3. Create or import `todo.md` if needed.
4. Use the calendar action in the sidebar to check the current week, create next week, or choose a week range.

Workspace location is managed from Settings. Todo and Scratchpad paths are derived as `<workspace>/todo.md` and `<workspace>/scratchpad.md`.

## Navigation

- Use the fixed Todo and Scratchpad entries above the week tree to switch workspace views.
- Use **Back** and **Forward** from the app menu or keyboard shortcuts to revisit view history.
- `Ctrl + PageUp`: open the previous existing log file in sidebar order.
- `Ctrl + PageDown`: open the next existing log file in sidebar order.
- Navigation crosses week boundaries without expanding collapsed sidebar folders.
- The week-order control determines whether older or newer weeks come first.

## Todo

- `Enter`: add a todo.
- `Tab` / `Shift + Tab`: indent or outdent.
- `Alt + ArrowUp` / `Alt + ArrowDown`: reorder the focused visible todo.
- Use the toolbar to show row numbers, fold/unfold, undo/redo, reload, and add todos.
- `Ctrl + click`: select multiple todos.
- `Shift + click`: select a visible range.
- Right-click selected todos for bulk actions and send-to actions.
- Right-click editable todo text for Cut, Copy, Paste, and Select All.

## Daily Log

Daily logs contain sessions, activities, subjects, time, and notes.

Activity Markdown format:

```markdown
- {subjects: (rust, ui), time: 120m} Refactored the settings panel layout.
```

Use `time: ?` when an activity has no known duration. Mixed totals display the known lower bound with `+`; all-unknown totals display `?`.

Session suggestions come from the current weekly plan first, then app-local session history.
Sessions planned during the current week are marked with `*` in the suggestion list. The marker is display-only and is never stored in Markdown.

Daily session and activity context menus provide text editing, movement, and deletion actions where applicable. Daily and weekly note editors provide Cut, Copy, and Paste.

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

Plan card subject and time summaries are derived from planned activities. Cards can be duplicated from their context menu. Weekly Planned and Weekly Actual headers show aggregate duration totals; Weekly Actual remains read-only.

Clicking a day header collapses or expands that day in both Weekly Plan and Weekly Actual. At least one day remains expanded, and the collapse state is temporary UI state rather than workspace data.

Weekly objectives support indentation levels `0` through `2`:

```markdown
- {subjects: (tracker), status: open} Improve tracker
  - {subjects: (ui), status: partial} Refine objective layout
    - {subjects: (parser), status: done} Preserve nested Markdown
```

- `Tab` / `Shift + Tab`: indent or outdent the objective being edited.
- Foldable objectives hide consecutive, more deeply indented rows without changing Markdown.
- Objective context menus provide Indent, Outdent, Move Up, Move Down, Delete, and text clipboard actions.
- Objective fold state is remembered independently per week until the application closes. Context menus can collapse or expand all foldable objectives.

## Notes and Scratchpad

Daily, Weekly, and Scratchpad notes share one continuous Markdown editor:

- Live preview keeps Markdown structure editable in place.
- Source view uses a monospace font.
- Headings, emphasis, links, code, lists, and task markers are supported.
- Enter continues normal, numbered, and task lists.
- Scratchpad headings and nested lists can be folded without changing their Markdown; fold state is retained for the app session.
- Scratchpad stores raw Markdown at `<workspace>/scratchpad.md` without frontmatter or wrapper fences.
- Daily and Weekly `## Notes` sections use dynamically sized `tracker-notes` fences so headings inside notes cannot alter document structure.

## Settings

- Workspace folder.
- Derived Todo and Scratchpad file locations with Found/Missing status.
- Frontmatter mode: `Off` or `Personal`.
- Rebuild subject history.
- Rebuild session history.
- Developer Mode for the app-controlled DevTools shortcuts and Inspect Element action.

History files are app-local and ignored by git:

- `subject-history.json`
- `session-history.json`

## Migrating Older Objective Metadata

v1.2.0 objectives no longer use `origin: planned` or `origin: unplanned`. Preview the included migration before applying it to an older workspace:

```bash
npm run migrate:objectives -- <workspace-path>
npm run migrate:objectives -- <workspace-path> --write
```

Back up the workspace and review the dry-run output before applying the migration.

## Migrating Notes for v1.3.0

v1.3.0 stores the terminal `## Notes` section in a dynamically sized `tracker-notes` fence so note headings cannot be mistaken for Daily or Weekly sections. Preview the migration first:

```bash
npm run migrate:notes -- <workspace-path>
npm run migrate:notes -- <workspace-path> --write
```

The write pass creates a timestamped backup under `<workspace-path>/.tracker-backups/` before changing recognized Daily logs or Weekly indexes. It skips already-wrapped files and malformed wrappers, and a second pass is a no-op.

Downgrade warning: v1.2.0 does not understand the `tracker-notes` boundary. Restore the timestamped backup before editing migrated files with v1.2.0, especially when notes contain `##` headings.

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

The portable zip is written to `build-artifacts/tracker-widget-portable-v1.4.0.zip`.
