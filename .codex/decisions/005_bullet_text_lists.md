---
id: 005
name: bullet_text_lists
status: review
created: 2026-04-17
started: 2026-04-17
completed:
depends_on:
  - 004
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The current semantic capture supports DOM lists such as `ul` and `ol`, but not bullet-style text captured from multiline selections or visually formatted content. This causes bullet content to be stored as paragraphs and rendered as plain text instead of Markdown lists.

## How
Add a conservative bullet-text inference step in the picker for clicked blocks and text-range selections. Detect common list markers such as `-`, `*`, `•`, and numbered items like `1.` only when there are multiple lines with consistent markers. When detected, capture the block as `format: list` with normalized `listItems` and `orderedList`. Keep paragraph behavior as the fallback for ambiguous text.

## Steps
- [x] Add tests for Markdown rendering of unordered and ordered list blocks inferred from bullet text
- [x] Extend picker capture to infer list blocks from multiline bullet-style text in both clicked elements and text selections
- [x] Keep inference conservative so regular paragraphs with punctuation are not converted into lists by mistake

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Risks / Notes
- Bullet inference must avoid false positives on marketing copy with line breaks.
- Numbered steps like version numbers or dates should not be mistaken for ordered lists unless the block is clearly multiline and list-shaped.
