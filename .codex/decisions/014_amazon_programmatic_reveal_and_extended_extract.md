---
id: 014
name: amazon_programmatic_reveal_and_extended_extract
status: completed
created: 2026-04-20
started: 2026-04-20
completed: 2026-04-20
depends_on:
  - 013
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The current Amazon profile improved extraction by preferring the hidden `pqv` summary, but live inspection shows two additional high-signal areas still missing from the Markdown output: the collapsed `Detalles del producto` section and the `Ver todas las especificaciones del producto` side sheet. Those regions are safe to reveal and contain structured product data that users expect in the export. The current reveal mechanism is also too limited because it only supports selector clicks and assumes physical click behavior, while the live page can block pointer events with a video overlay.

## How
Extend the site-profile contract so reveal steps can target elements by selector or exact visible text and run as programmatic DOM clicks inside the injected picker runtime. Keep the reveal layer safe and idempotent: only allow explicit click steps authored in the profile, never generic heuristic clicks.

For Amazon, keep the current `pqv` extraction path as the primary source for long-form product summary content, then add safe reveal steps for:

- `Detalles del producto`
- `Ver todas las especificaciones del producto`
- optional overview expanders such as `Ver más` or `Mostrar más`

After reveal, extend extraction to read structured content from:

- `#item_details`
- `#voyager-ns-desktop-side-sheet-content`
- existing `pqv` sections

The profile should stay narrowly selector-driven to avoid importing video overlays, feedback widgets, report-issue links, or commercial popovers. The new reveal implementation should support exact-text matching because some Amazon triggers do not have stable IDs or are exposed through nested elements whose visible text is the only reliable signal.

## Steps
- [x] Add failing tests that prove Amazon should extract product-details and side-sheet content after reveal, while still excluding known overlay noise
- [x] Extend the shared reveal-step contract to support safe programmatic clicks by selector and exact text
- [x] Update the picker/profile runtime to execute the new reveal steps idempotently before extraction
- [x] Expand the Amazon profile to reveal and extract `item_details`, `voyager` specifications, and optional overview expanders in addition to `pqv`
- [x] Update fixtures and AGENTS docs to reflect the expanded Amazon strategy

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- Exact-text reveal steps are locale-sensitive, so they should be used only inside site-specific profiles where the locale/layout assumption is explicit.
- Programmatic clicks must remain constrained to whitelisted steps authored in the profile; they should not become a general-purpose DOM automation layer.
- The `voyager` side sheet content exists hidden in the DOM on some layouts, but the reveal step is still useful to keep extraction aligned with the user-visible state and with layouts that lazy-fill the panel on open.
