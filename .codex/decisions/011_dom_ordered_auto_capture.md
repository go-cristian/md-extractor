---
id: 011
name: dom_ordered_auto_capture
status: completed
created: 2026-04-18
started: 2026-04-18
completed: 2026-04-18
depends_on:
  - 009
  - 010
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The current manual-first picker still requires too much curation effort and the text-drag capture path is unreliable. The user wants a simpler first-version workflow where activating extraction is the explicit signal that the page is already ready, the extension auto-extracts immediately in document order, and then the user only removes or adds nodes visually by clicking on the page. The side panel should stop exposing internal block inventory and instead focus on the generated Markdown only.

## How
Replace the current optional primary-capture idea with an activation-time automatic traversal of the page DOM. The button that today activates the picker becomes `Activar extracción`, and clicking it is treated as the user's explicit readiness signal. At that moment, before manual toggling begins, the content script should walk the active page in document order and collect nodes that map directly to Markdown blocks: headings, paragraphs, lists, tables, and images. The traversal should use a `TreeWalker` or equivalent DOM-order walk rooted at `document.body`, while skipping hidden/noisy nodes and deduplicating nested captures so parent wrappers do not absorb child semantic nodes.

Each captured block should carry a stable internal selection key plus an internal document-order key derived from DOM ancestry indices. The draft remains the source of truth, but items are now treated as an internal ordered set rather than a user-managed list. Click capture should reuse the same node classification and toggle semantics: clicking an already selected node removes it; clicking a valid unselected node adds it back in the correct DOM order instead of append order.

Remove freeform text-range capture entirely. The picker should become click-only. Likewise, simplify the side panel so it renders controls plus Markdown preview only. Selection summaries, manual labels, note editor, and drag-reorder UI should be removed from the visible surface. The internal draft can still keep structured items because the Markdown generator and highlight sync depend on them, but the user should not manage those items directly from the panel.

The side panel should expose three separate actions with non-overlapping semantics:

- `Activar extracción`: if there is no active draft for the current page, auto-extract and then enable click toggling; if a draft already exists for the same page, only re-enable interactive toggling/highlights without replacing it.
- `Reiniciar`: discard the current page draft and run the same automatic extraction again from a clean state.
- `Limpiar todo`: remove the current draft entirely without auto-extracting again.

This keeps the main activation flow lightweight while making full regeneration explicit instead of destructive.

## Steps
- [x] Add failing tests for activation-time auto-capture in DOM order, click-only toggling, and side-panel markdown-only rendering
- [x] Introduce a stable internal order key for captured nodes so draft items can always be re-sorted by document order instead of insertion order
- [x] Replace the current activation flow so `Activar extracción` immediately runs automatic DOM traversal over markdown-valid nodes, then hands off to click toggling without requiring an extra capture step
- [x] Add explicit `Reiniciar` and `Limpiar todo` actions, with `Reiniciar` re-seeding the draft from a fresh DOM traversal and `Limpiar todo` only clearing state
- [x] Remove text-range drag capture and make manual interaction strictly click-to-toggle using the same node classifier as the automatic traversal
- [x] Simplify the side panel to controls plus Markdown preview only, removing selection inventory, note editor, label editing, and drag-reorder affordances from the visible UI
- [x] Update E2E coverage for auto-seeded markdown, click removal/addition, and the simplified panel workflow

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- A raw full-body traversal can overcapture headers, footers, nav, or recommendation widgets; the implementation will need aggressive visibility/noise filtering plus semantic dedupe.
- Removing the visible item list means DOM order becomes the primary authoring order. If later reordering is needed, it should come back as a separate decision instead of staying half-supported.
- Hiding manual notes and labels is an intentional scope reduction for this version. If they remain needed, they should be reintroduced through a simpler markdown-level editing model rather than item cards.
- The activation button now carries two responsibilities: start the interactive picker and seed the initial extraction when no draft exists. That coupling is intentional, because it uses the user's click as the readiness signal instead of guessing page-load completion.
- `Reiniciar` is intentionally different from pause/resume. It is the only action that should regenerate the draft from scratch after the first extraction.
