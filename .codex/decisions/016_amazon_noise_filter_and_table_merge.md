---
id: 016
name: amazon_noise_filter_and_table_merge
status: completed
created: 2026-04-20
started: 2026-04-20
completed: 2026-04-20
depends_on:
  - 015
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The Amazon profile now reveals and extracts useful hidden product content, but live exports still begin with low-value noise and fragmented metadata. The remaining issues are profile-specific rather than renderer-wide: shipping/location text, wishlist errors, and the hero image can surface near the top of the Markdown, while small two-column metadata tables are emitted as separate tables even though the user wants them as one normalized key/value section.

## How
Keep the fix scoped to the Amazon extraction profile. Add a fixture that reproduces the real noisy output pattern and drive the implementation with failing tests first.

The Amazon profile should:

- exclude known low-value text and containers related to shipping destination, wishlists/lists, and transient list errors
- avoid auto-emitting the hero image in the initial export for Amazon product pages
- normalize adjacent two-column key/value tables from Amazon details/spec blocks into a single semantic table when they belong to the same product-metadata region

This should happen before Markdown rendering so the renderer stays generic. The implementation can add Amazon-specific post-processing helpers in shared extraction code, but it must not become a global noise filter for all sites.

## Steps
- [x] Add failing tests and a fixture fragment that reproduce the Amazon shipping/wishlist noise, hero image, and fragmented metadata tables
- [x] Implement Amazon-specific filtering for low-value shipping/list noise and suppress the auto hero image block
- [x] Merge adjacent Amazon key/value tables into a single normalized table while preserving title-first ordering and the rest of the useful content
- [x] Update AGENTS docs and run full verification

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- Noise filtering must stay narrow and text-pattern based only where the source containers are not stable; avoid deleting legitimate product copy.
- Table merging should only apply to Amazon profile output and only for simple two-column key/value tables; do not alter arbitrary Markdown tables globally.
- Suppressing the hero image is an Amazon-specific UX choice for now and should not change generic image extraction behavior.
