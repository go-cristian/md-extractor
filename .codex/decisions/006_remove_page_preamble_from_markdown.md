---
id: 006
name: remove_page_preamble_from_markdown
status: review
created: 2026-04-17
started: 2026-04-17
completed:
depends_on:
  - 004
  - 005
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The generated Markdown currently starts with automatic page context such as the page title, source URL, site, capture timestamp, and extracted metadata. The user wants the Markdown to start from zero and contain only the content they explicitly captured.

## How
Keep page context and metadata internally for the side panel summary and picker behavior, but stop rendering the automatic document title and metadata preamble in the Markdown output. The Markdown generator should emit only user-captured blocks, still preserving semantic formatting for headings, lists, tables, images, and notes. If there are no captured items, render an empty-state message instead of synthetic page content.

## Steps
- [x] Update Markdown generation to omit the automatic page title and metadata preamble
- [x] Adjust tests so output starts from captured content only
- [x] Verify that side panel summary and capture logic still retain page context outside the Markdown body

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`

## Risks / Notes
- Removing the preamble means copied Markdown will no longer preserve the source URL unless the user captures it explicitly.
- Empty drafts should still communicate that nothing has been captured yet without introducing page metadata into the output.
