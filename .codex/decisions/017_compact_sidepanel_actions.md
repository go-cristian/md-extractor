---
id: 017
name: compact_sidepanel_actions
status: completed
created: 2026-04-20
started: 2026-04-20
completed: 2026-04-20
depends_on:
  - 016
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The current side panel exposes too many top-level controls for the MVP. The user wants a tighter control area with at most two visible buttons while keeping extraction start, restart, and clear available. The context toggle should be removed from the visible UI.

## How
Keep the side panel action area to two visible controls:

- primary extraction button (`Activar extracción` / `Pausar extracción`)
- secondary actions button that opens a compact menu with `Reiniciar` and `Limpiar todo`

Remove the context toggle from the side panel wiring and presentational props, but leave the background/context capability untouched for now since this is a UI-scope reduction, not a storage or protocol removal.

Update the presentational tests to assert the reduced control surface and the menu-driven callbacks. Add any minimal styling needed so the actions menu is anchored in the header without expanding the visible control count.

## Steps
- [x] Add failing side panel tests for the two-button header and menu-driven restart/clear actions
- [x] Remove the visible context toggle from App/View wiring and implement the compact actions menu in the side panel UI
- [x] Update sidepanel AGENTS docs and run full verification

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- This intentionally leaves the `TOGGLE_CONTEXT` message path in the background untouched to keep the change scoped to the current UI requirement.
- The actions menu should stay keyboard-clickable and not depend on complex focus trapping for this MVP.
