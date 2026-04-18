---
id: 001
name: project_scaffold
status: review
created: 2026-04-17
started: 2026-04-17
completed:
depends_on: []
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
Bootstrap the project structure, tooling, and Codex-oriented AI development system.

## How
Set up the repository structure, TypeScript, linting/formatting, testing scaffolds, AGENTS.md hierarchy, `.codex/workflows/`, `.codex/decisions/`, and policy scaffolding.

## Steps
- [x] Create repository structure and workspace/build configuration appropriate to the declared stack
- [x] Configure TypeScript with strict settings
- [x] Configure linting and formatting
- [x] Configure unit test scaffold
- [x] Configure E2E test scaffold
- [x] Create root `AGENTS.md` with the AI Development System section
- [x] Create `.codex/workflows/` (`explorer.md`, `plan.md`, `implement.md`)
- [x] Create `.codex/decisions/pending.md`
- [x] Create directory-level `AGENTS.md` files
- [x] Create policy file requiring an approved decision before editing source files

## Test Coverage
- Unit tests for reducer, Markdown generator, adapters and side panel interactions
- Playwright E2E for extension loading, picker capture and copy flow

## Risks / Notes
- The E2E harness opens the sidepanel page directly with `?tabId=` during tests because browser-level side panel controls are not practical to automate reliably in Playwright.
- Picker injection relies on `activeTab` and action click behavior rather than broad host permissions.
