# Changelog

## [1.3.0] - 2026-07-26

### Added

- Global workspace Scratchpad with raw Markdown persistence, autosave, live preview, source view, conflict handling, navigation history, and window-mode support.
- Week-file action menu for checking the current week, creating next week, and creating or repairing an explicit week range.
- Safe week context actions for check/repair, Personal frontmatter conversion, and Recycle Bin deletion.
- Unknown activity durations using `time: ?`, with known lower-bound and all-unknown total semantics.
- Weekly Planned and Weekly Actual duration totals.
- Weekly plan-card duplication and editable session-name clipboard actions.
- Session-wide, per-week objective fold memory and bulk collapse/expand context actions.
- Unified application menus, Back/Forward view history, and fixed Todo/Scratchpad sidebar entries.
- Single-instance launch protection that restores and focuses the existing window instead of opening another process.

### Changed

- Daily, Weekly, and Scratchpad notes now share a continuous CodeMirror-based Markdown editor with live preview, source view, list continuation, task widgets, and consistent styling.
- Daily and Weekly note sections use dynamically sized `tracker-notes` fences, preserving Markdown heading hierarchy.
- Daily and Weekly layouts scale to wider windows while retaining their minimum sizes.
- Header controls, dialogs, dropdowns, tooltips, close buttons, notifications, and settings layout were standardized.
- Weekly Planned and Weekly Actual use shared day-column presentation.
- Long descriptions and unbroken tokens wrap without expanding their panels.

### Fixed

- Objective folds no longer reset when navigating between views during the same application session.
- Wrapped text selection follows visible glyphs instead of oversized rectangular selection bands.
- Note task markers, Enter continuation, task spacing, and checkbox alignment behave consistently.
- History rebuild notifications remain visible.
- Large page headings no longer resize with the application window.

### Migration

- Run `npm run migrate:notes -- <workspace-path>` to preview the v1.3.0 note-boundary migration.
- Run `npm run migrate:notes -- <workspace-path> --write` to create a timestamped workspace backup and migrate recognized files.
- v1.2.0 cannot safely edit migrated note sections. Restore the migration backup before downgrading.
