---
id: 021
name: preview_block_remove_controls
status: completed
created: 2026-04-20
started: 2026-04-20
completed: 2026-04-20
depends_on:
  - 018
  - 019
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The preview currently renders the final Markdown as one monolithic `pre`, which makes it easy to copy but hard to curate. The user does not want a global clear action; they want to remove individual selections that are already part of the output, directly from the preview area.

## How
Keep the preview area focused on Markdown only, but render it as ordered Markdown blocks instead of one single text blob. Each rendered block will expose a small remove button beside its Markdown fragment. Clicking that button will remove the underlying selection through the existing `REMOVE_SELECTION` message, preserving the normalized draft model (`selectionKey` identity, `orderedKeys` ordering) and synchronizing page highlights.

The full `Copiar Markdown` action remains and still copies the fully concatenated Markdown output. The sidepanel will not expose internal metadata or a separate selection list; it will only show the Markdown fragments in document order with per-block remove affordances.

For notes or any block without a stable page element, removal still works by `itemId`, which the current background reducer already supports. The top control area remains unchanged.

## Steps
- [x] Add failing sidepanel tests for rendering ordered Markdown fragments with a remove control per block
- [x] Add a sidepanel callback that calls `REMOVE_SELECTION` by item id and update the preview to render removable Markdown blocks instead of one monolithic `pre`
- [x] Update or add E2E coverage for removing a block from the preview and verifying the Markdown and highlights update consistently

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- The preview will stop being a literal one-node `pre`; it becomes a block-rendered Markdown view. Copy still uses the full generated Markdown string, so export behavior does not change.
- Removal from the preview must preserve document order for the remaining blocks and must not reintroduce any text-editing semantics.
