---
id: 004
name: semantic_markdown_blocks
status: review
created: 2026-04-17
started: 2026-04-17
completed:
depends_on:
  - 001
  - 003
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
Selections were rendered as generic blocks like `## Seleccion N`, even when the user clicked a heading, list, or table. This produced noisy Markdown and duplicated the page title.

## How
Add semantic block metadata to captured selections, infer headings/lists/tables in the picker, skip duplicate captures of the main document title, and render Markdown according to the block format instead of wrapping everything under generic section headings.

## Steps
- [x] Extend selection types to carry semantic markdown format and structured table/list payloads
- [x] Infer semantic block type during click capture and avoid duplicating the main page title
- [x] Render semantic markdown blocks in the generator and keep UI/tests aligned

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Risks / Notes
- Table inference is intentionally conservative and based on visible rows/cells only.
- Text-range captures are still normalized as paragraph blocks unless they clearly map to a richer clicked element.
