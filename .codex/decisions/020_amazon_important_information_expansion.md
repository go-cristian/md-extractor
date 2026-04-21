---
id: 020
name: amazon_important_information_expansion
status: completed
created: 2026-04-20
started: 2026-04-20
completed: 2026-04-20
depends_on:
  - 016
  - 019
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The current Amazon extraction profile already captures useful title, price, bullets, details tables, and some preloaded quick-view content, but it still underextracts a high-value section for supplements and similar regulated products: `Información importante`. In the live Amazon product flow, that section can contain the most actionable product data for downstream AI/docs use, including safety warnings, directions, ingredients, instructions, and regulatory disclaimers.

Right now the Amazon profile only has shallow coverage for `pqv-important-information`: it extracts a heading, nested `h3` subsections, and paragraphs when they are already present in the fixture. That is not enough to guarantee that the real product structure is captured end-to-end. We need to explicitly support the richer quick-view/expanded information structure and ensure the extractor preserves it as ordered semantic Markdown blocks without reintroducing surrounding Amazon noise.

## How
Keep the change tightly scoped to the Amazon site profile and its fixtures.

Extend the Amazon extraction path so `Información importante` is treated as a first-class extraction region. The profile should continue preferring pre-rendered hidden DOM (for example `pqv` overlays or similar preloaded sections) before relying on more fragile reveal flows. Then it should extract the section in semantic order:

- section heading (`## Información importante`)
- subsection headings (`### Información de seguridad`, `### Indicaciones`, `### Ingredientes`, `### Instrucciones`, `### Exclusión de garantías y responsabilidad`)
- associated paragraph or list content under each subsection

The implementation should stay generic enough to support both English and Spanish Amazon variants when the DOM shape is the same, but the immediate fixture/test target is the Spanish content block the user provided.

To avoid regressions, this should not be implemented as a loose global paragraph sweep. Instead:
- extend the Amazon profile selectors for important-information containers and subsection descendants
- preserve document order within that region
- keep the existing Amazon noise filtering narrow so surrounding commercial/help UI is still excluded
- avoid collapsing adjacent important-information subsections into one giant paragraph if the DOM provides explicit subheadings

If the relevant content only becomes available after a safe reveal step in some layouts, add that reveal only if it is deterministic and clearly scoped to product-information UI. Do not broaden the reveal surface to popovers or commerce widgets that are unrelated to product facts.

## Steps
- [x] Add failing tests and fixture coverage for a richer Amazon `Información importante` block containing safety, directions, ingredients, instructions, and disclaimer subsections in semantic order
- [x] Extend the Amazon extraction profile selectors and any required safe reveal hooks so the important-information region is captured as heading/subheading/paragraph blocks without surrounding Amazon noise
- [x] Mirror the behavior in the injected picker runtime so seeded extraction matches shared extraction tests for Amazon
- [x] Update AGENTS docs for shared/content if the Amazon profile conventions or important-information handling become more explicit, then run full verification

## Test Coverage
- Unit tests in `tests/shared/extractionProfiles.test.ts` for Amazon important-information extraction order and subsection presence
- Fixture updates in `tests/fixtures/amazon-product.html` and/or a dedicated Amazon fixture variant for supplement-style important-information content
- E2E coverage in `e2e/extension.spec.ts` asserting that the Markdown preview contains the expected important-information headings and bodies on Amazon fixtures
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- Amazon has multiple layouts and locale variants; selectors must stay shape-driven, not string-matched on exact Spanish labels alone.
- The section may appear either preloaded or behind a safe expand affordance depending on product type. Prefer preloaded DOM first, reveal second.
- Important-information blocks can be long. Preserve subsection structure instead of flattening everything into one paragraph, or the result will be harder to use for AI/docs.
- This slice should not broaden the Amazon profile into a generic “capture all hidden text” rule. The extraction region must stay narrow and product-information oriented.
