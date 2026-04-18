---
id: 003
name: capture_visible_text
status: review
created: 2026-04-17
started: 2026-04-17
completed:
depends_on:
  - 001
  - 002
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
Click captures on complex ecommerce pages such as Amazon are including CSS, inline scripts, JSON blobs and oversized wrapper text, which makes the generated Markdown noisy and misleading.

## How
Make the picker choose tighter containers based on visible text length, extract sanitized visible text instead of raw `textContent`, and add unit tests for the text-cleaning helper used by shared DOM reads.

## Steps
- [x] Add a shared DOM text cleaner with tests for script/style/noise removal
- [x] Update picker container heuristics to prefer smaller visible-text blocks
- [x] Capture sanitized visible text and cleaner HTML snippets for clicked blocks

## Test Coverage
- Unit tests for DOM text extraction and noise filtering
- Existing typecheck, lint and unit suites

## Risks / Notes
- `innerText` is more representative of user-visible content but can differ slightly from `textContent` across browsers. The fallback path should remain conservative.
- Verification completed with `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`.
