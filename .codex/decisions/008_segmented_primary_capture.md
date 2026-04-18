---
id: 008
name: segmented_primary_capture
status: completed
created: 2026-04-17
started: 2026-04-17
completed: 2026-04-17
depends_on:
  - 004
  - 005
  - 006
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The current flow still captures large DOM containers as raw paragraph blocks, appends `Referencia DOM` to the exported Markdown, and suppresses the main title when it matches page metadata. That produces Markdown that is noisy for downstream AI or documentation workflows, especially on dense product pages such as Amazon. The user needs concrete page information extracted into clean semantic blocks, with a faster workflow where the tool captures the main content first and the user only removes what is not useful.

## How
Keep the side panel as the main editing surface, but change capture behavior from container-oriented extraction to segmented semantic extraction.

Introduce a primary-capture action that detects the most relevant content root on the page and expands it into multiple `SelectionItem` blocks instead of one large paragraph. The segmentation should prefer headings, bullet lists, tables, images, and bounded paragraphs, preserving page order. For product pages, the initial heuristic should prefer the main content region (`main`, `article`, `[role="main"]`, known product content roots) and then walk direct semantic descendants rather than serializing the entire container text.

The exported Markdown should only contain content intended for downstream consumption. `selectorHint` should remain internal metadata for debugging or future features, but it should no longer render in Markdown. The side panel should continue to show editable block summaries and deletion controls so users can prune unwanted blocks after a primary capture.

This change also restores explicit capture of the main title as a heading block, because the Markdown output no longer has an automatic page-title preamble. Title suppression is now harmful and should be removed.

## Steps
- [x] Add tests for clean Markdown export without `Referencia DOM` while preserving semantic rendering for headings, lists, tables, images, and notes
- [x] Add tests for primary heading capture so the main product title can be selected explicitly
- [x] Introduce a primary-capture path in the picker/content script that finds a relevant root and segments it into ordered semantic blocks instead of a single paragraph blob
- [x] Keep manual click and text-range capture, but tighten paragraph fallback so oversized generic containers are avoided when a semantic segmentation path is available
- [x] Update the side panel copy and controls to expose the primary capture workflow as the default fast path, with deletion used for pruning
- [x] Update unit and E2E coverage to validate the new flow on fixture pages with dense product content

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`

## Risks / Notes
- Primary-root detection can still overcapture if heuristics are too broad, so the implementation should bias toward direct semantic children and cap paragraph block size.
- Some sites will not have a clean `main` or `article` root; the fallback should remain safe and deterministic rather than site-specific.
- `selectorHint` should be retained in state for diagnostics, but hidden from exported Markdown.
- This decision effectively supersedes the narrower title-only fix in `007_restore_primary_title_capture.md`; if approved, implementation should resolve the title regression as part of this broader change.
