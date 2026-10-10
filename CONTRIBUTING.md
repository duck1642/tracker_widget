# Contributing

Thanks for your interest in Tracker Widget.

## Before You Start

- Search existing issues before opening a new one.
- Use issues for bug reports and feature requests.
- Do not report security vulnerabilities publicly. See [SECURITY.md](SECURITY.md).
- Feature development is currently paused. Discuss substantial new features before starting implementation.

## Development Setup

Install Node.js 24.12.0 or newer, Rust, and the Tauri development prerequisites, then run:

```bash
npm install
npm run tauri dev
```

## Checks

Before opening a pull request, run the checks relevant to your change:

Application modules, frontend tests, and Svelte scripts use strict TypeScript. Keep tests in the type-checking scope and avoid disabling type checking to silence errors.

```bash
npm run test
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

## Pull Requests

- Keep changes focused and explain their user-facing impact.
- Update documentation or tests when the change requires it.
- Include screenshots or a GIF for meaningful UI changes when useful.
- Do not commit build artifacts, personal workspace files, or secrets.
- Review and test AI-assisted code before submitting it.
