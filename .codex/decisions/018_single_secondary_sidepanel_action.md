---
id: 018
name: single_secondary_sidepanel_action
status: completed
created: 2026-04-20
started: 2026-04-20
completed: 2026-04-20
depends_on:
  - 017
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The current side panel still exposes two secondary reset-style actions that read as the same operation for the MVP. The user wants a single secondary button with a clearer meaning.

## How
Replace the `Acciones` menu with one direct secondary button dedicated to re-running extraction from scratch. Remove `Limpiar todo` from the visible sidepanel UI and keep only:

- primary extraction toggle (`Activar extracción` / `Pausar extracción`)
- secondary reset button with explicit wording (`Extraer de nuevo`)

The background `CLEAR_DRAFT` capability can remain in place for now; this slice is a UI simplification only. Update presentational tests and E2E assertions to reflect the two visible buttons and the absence of the actions menu.

## Steps
- [x] Add failing tests for the two-button header with a single secondary re-extract action
- [x] Replace the actions menu in the sidepanel UI with one direct secondary button and remove clear from visible controls
- [x] Update sidepanel docs and run full verification

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- This intentionally removes the visible empty-state reset from the sidepanel, so the only reset path in the MVP becomes re-extraction from scratch.
- The background clear message remains available internally to avoid widening this UI change into a protocol cleanup.
