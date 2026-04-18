---
id: 010
name: context_toggle_remove_primary_ui
status: completed
created: 2026-04-17
started: 2026-04-17
completed: 2026-04-17
depends_on:
  - 008
  - 009
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The current primary-capture shortcut is not producing reliable first-pass results for the user, so keeping it visible in the main UI adds friction instead of speed. At the same time, the user wants a lightweight way to prepend concrete page context to the exported Markdown when that metadata is useful for downstream AI or documentation workflows.

## How
Persist a draft-level boolean that controls whether page context is rendered at the beginning of the Markdown output. The context block should be generated from existing draft metadata and page fields, stay outside the editable selection list, and be toggled from the side panel with a single button whose label switches between `Agregar contexto` and `Quitar contexto`.

The Markdown generator should prepend a compact `Contexto` section before the selected blocks only when this flag is enabled. The section should include stable page-level fields already available in the draft, such as title, site, URL, and any detected product metadata that exists.

Remove the `Capturar principal` control and related copy from the side panel so the first-version workflow is reduced to manual picker capture plus optional context prepend. To keep the change small and reversible, the underlying background/content implementation for primary capture can remain in place for now, but it should no longer be exposed from the UI or covered as a primary user flow.

## Steps
- [x] Add failing tests for Markdown context prepend and for the side panel toggle/removal of the primary-capture button
- [x] Introduce a draft-level flag for including page context and a reducer/message path to toggle it persistently per tab draft
- [x] Update Markdown generation to prepend a compact context section when enabled, using existing page metadata only
- [x] Remove `Capturar principal` from the side panel UI and update surrounding copy to reflect the manual-picker-first workflow
- [x] Update E2E coverage to validate the context toggle flow and stop depending on the removed primary-capture UI path

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- The context block must stay derived from draft metadata, not become a mutable selection item, or the ordering model becomes harder to reason about.
- Removing the primary-capture button from the UI is intentionally narrower than deleting the underlying implementation; this keeps rollback cheap if the flow is reintroduced later.
- If no draft exists yet, the context toggle should stay disabled or no-op until page context is available from the active tab.
