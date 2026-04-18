---
id: 009
name: persistent_selection_highlights
status: completed
created: 2026-04-17
started: 2026-04-17
completed: 2026-04-17
depends_on:
  - 008
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The current picker only shows a transient hover overlay. Once a block is captured, the page itself no longer communicates what is already selected, so users have to cross-check against the side panel. This makes iterative capture slower than necessary. The user wants captured selections to stay visibly highlighted on the page and to be removable by clicking the same block again.

## How
Add persistent in-page highlights for block-level selections that can be mapped back to concrete DOM elements through the existing semantic target resolution and `selectorHint` metadata. Use a yellow highlight style distinct from the teal hover overlay so users can tell the difference between “hover target” and “already selected”.

When the picker is active, a click on a block should resolve the same semantic capture target as before. If that target is not selected, capture it and apply the persistent highlight. If that target is already selected, remove the corresponding selection from the draft and remove the highlight.

Keep the highlight state derived from the draft, not from local ad-hoc DOM state. The background should notify the content script after add/remove/clear operations so the page can re-sync highlighted nodes. This also keeps side panel deletes and draft clears consistent with the page state.

For the first iteration, scope persistent highlights to block selections (`element` and `image`) created by click capture and primary capture. Do not attempt persistent DOM reconstruction for freeform `textRange` selections yet; those will continue to exist only in the draft and side panel.

## Steps
- [x] Add tests for highlight-state synchronization and toggle semantics on block selections
- [x] Introduce a stable selection-match key for block captures so the same semantic DOM target can be toggled on second click
- [x] Add background-to-content synchronization for current highlighted selections after add/remove/clear actions
- [x] Add persistent yellow highlight rendering in the content script, separate from the hover overlay
- [x] Make second click on an already selected block remove the matching draft item instead of adding a duplicate
- [x] Update E2E coverage for toggle-on, toggle-off, and side-panel delete synchronization

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- `selectorHint` is heuristic, so toggle matching should use the same semantic target resolution path used for capture, not only raw string equality.
- If multiple selections collapse onto the same target, removal should be deterministic and remove the first matching draft item.
- Freeform dragged text ranges are intentionally out of scope for this first iteration because persistent DOM reconstruction is brittle.
