---
id: 013
name: amazon_preloaded_summary_profile
status: completed
created: 2026-04-19
started: 2026-04-19
completed: 2026-04-19
depends_on:
  - 012
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The first Amazon profile proved the site-specific approach, but the new real fixtures show a better extraction path than visible-page traversal plus reveal clicks. Amazon already ships a hidden preloaded product summary (`productQuickView` / `pqv`) in the DOM before the user opens it. That summary contains structured bullets, description, and important information that map much more cleanly to Markdown than the noisy visible page. The extractor should prefer that preloaded summary when it exists, while still keeping the safe reveal and generic fallback paths.

## How
Refine only the Amazon profile. Keep the generic fallback and profile contract unchanged.

The new Amazon strategy is:

1. keep top-level product fields from the visible page when they are canonical there (`#productTitle`, price, seller, hero image)
2. prefer preloaded `pqv` sections for curated long-form content:
   - `#pqv-feature-bullets`
   - `#pqv-description`
   - `#pqv-important-information`
3. keep structured details tables from visible product-detail regions as fallback/additional structured data
4. keep the existing safe reveal step as a non-primary helper for layouts that still need it

This keeps extraction deterministic and avoids depending on opening live UI affordances just to reach content that is already present in the DOM.

Also extend the skill/reference documentation so future site-profile generation explicitly checks for hidden but pre-rendered summaries before proposing click-based reveal steps.

## Steps
- [x] Add failing tests that cover Amazon preloaded summary extraction for bullets and important information while avoiding obvious overlay noise
- [x] Refine the Amazon extraction profile to read preloaded `pqv` sections before fallback page regions
- [x] Update the Amazon fixture used by automated tests to represent the newly discovered summary structure
- [x] Document the preloaded-summary pattern in the skill/reference docs using the local Amazon before/after/source markdown files as examples
- [x] Update affected AGENTS documentation if the documented extraction behavior changes

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- Preloaded summary content may not exist on every Amazon layout, so visible-page selectors must remain as fallback.
- The hidden summary can contain UI noise such as feedback buttons or “report issue” links; extraction must stay narrowly selector-driven.
- The goal is not to mirror the full Amazon page. The goal is to capture the highest signal blocks that map cleanly to Markdown.
