---
id: 015
name: amazon_anchor_title_first
status: completed
created: 2026-04-20
started: 2026-04-20
completed: 2026-04-20
depends_on:
  - 014
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
Live Amazon exports still show useful blocks and some duplicate title text before the canonical product heading. The problem is not missing content, but ordering: profile-extracted content is globally re-sorted by DOM position, so hidden or side-sheet blocks can float above the title in the final Markdown. The export should start at the canonical product title while preserving the rest of the useful Amazon content.

## How
Extend the site-profile contract with optional anchor selectors. When a profile defines an anchor, extraction should:

1. detect the first matching anchor element in the document
2. keep the anchor selection first in the profile result regardless of DOM order
3. preserve DOM order for the remaining selections after the anchor
4. drop obvious non-heading duplicates whose text is exactly the same as the anchor title

This change should be profile-scoped, not global to Markdown generation. That keeps manual selections and the generic fallback untouched.

For Amazon, use the canonical title selectors as the anchor:
- `#productTitle`
- `[data-automation-id="product-title"]`

## Steps
- [x] Add failing tests for anchored profile ordering and duplicate-title cleanup
- [x] Extend the shared profile contract and extraction logic with optional anchor selectors
- [x] Mirror the anchor behavior in the injected picker runtime so seeded extraction matches shared tests
- [x] Set the Amazon profile anchor to the canonical title selectors and update any fixture needed to reproduce the ordering bug
- [x] Update affected AGENTS docs and mark the decision for review

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- This intentionally changes only auto profile extraction order, not manual selection order.
- The anchor must remain optional; many profiles may not need it.
- Duplicate-title cleanup must stay narrow to avoid deleting real descriptive paragraphs that merely mention the product name.
