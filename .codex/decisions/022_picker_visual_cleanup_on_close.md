---
id: 022
name: picker_visual_cleanup_on_close
status: completed
created: 2026-04-20
started: 2026-04-20
completed: 2026-04-20
depends_on:
  - 021
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The current picker can leave visual artifacts on the page after the sidepanel is closed: hover overlay, crosshair cursor state, and persistent yellow highlights. The user wants the page to return to a clean visual state when they stop using the panel, without losing the extracted draft.

## How
Treat closing the sidepanel as a visual shutdown of the picker runtime. This slice will make two changes:

- `STOP_PICKER` will clear page-side visual decorations, not just deactivate interaction.
- `App.tsx` will trigger that same stop path when the sidepanel unmounts or closes while extraction is active.

The cleanup must be visual-only:

- keep the draft in storage
- keep the rendered Markdown available when reopening the panel
- remove overlay, crosshair cursor, and persistent selection attributes/styles from the page

When the user activates extraction again, the picker can reapply highlights from the stored draft through the normal `activate + syncHighlights` flow.

## Steps
- [x] Add failing tests that define pause/close cleanup as visual-only and preserve the draft
- [x] Update picker deactivation so it clears persistent highlights and wire sidepanel unmount to `STOP_PICKER` when active
- [x] Add or update E2E coverage for closing or pausing the panel and verifying the page is visually clean while the draft persists

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- Cleanup on close should not clear the stored draft; otherwise closing the panel would feel destructive.
- If the panel is closed while a background operation is still resolving, the cleanup path should fail soft and leave storage untouched.
