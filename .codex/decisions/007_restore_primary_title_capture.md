---
id: 007
name: restore_primary_title_capture
status: draft
created: 2026-04-17
started:
completed:
depends_on:
  - 004
  - 006
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
After removing the automatic page preamble from the generated Markdown, the picker still suppresses captures of the main product title when it matches the page title. This prevents users from explicitly selecting the product title as a heading block on pages such as Amazon.

## How
Stop treating the primary heading as a duplicate when there is no automatic title rendered in the Markdown output. Keep heading inference and heading-level detection, but allow explicit clicks on the product title to create a `heading` selection item. Update tests and E2E expectations so the title is selectable again.

## Steps
- [ ] Add or update tests that verify the main product title can be captured as a heading block
- [ ] Remove duplicate-title suppression from picker and/or Markdown where it no longer applies
- [ ] Revalidate E2E flow for selecting the main title on fixture pages

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`

## Risks / Notes
- If title capture is restored without care, future reintroduction of automatic page preamble could recreate duplicate-title issues.
- The fix should preserve current behavior for non-title headings and semantic list/table detection.
