---
id: 012
name: site_profiles_with_reveal
status: completed
created: 2026-04-19
started: 2026-04-19
completed: 2026-04-19
depends_on:
  - 011
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The generic DOM-order traversal is a good fallback, but on complex commercial sites like Amazon it captures too much noise and misses important content that is hidden behind expandable UI. The extension needs a more deterministic site-specific path: identify the site, safely reveal relevant collapsed sections, extract from known areas, and only fall back to the generic traversal when no profile matches. In parallel, the repo needs a repeatable way to grow support for new sites from saved HTML fixtures instead of hand-authoring every profile from scratch.

## How
Introduce site extraction profiles that extend the existing site-adapter idea beyond metadata. A profile should be responsible for three things:

- matching a site/layout
- running a safe, idempotent `reveal` phase before extraction
- extracting markdown-valid blocks from known page regions in a predictable order

The `reveal` phase is intentionally narrow. It can only do safe UI expansion steps such as clicking `Ver más`, opening specifications accordions, or revealing hidden description sections. It must never trigger commerce or account actions like add-to-cart, buy-now, coupon redemption, variant switching, or login.

The runtime flow becomes:

1. detect profile
2. run profile `reveal` steps
3. extract via profile-specific selectors/regions
4. if no profile matches, or if the profile returns no blocks, use the existing generic fallback traversal

For the first implementation slice, add a real Amazon profile. It should extract a tighter set of blocks than the generic walker and support at least one reveal path in fixtures so the behavior is testable. Existing metadata extraction can continue to live in `siteAdapters`, but profile matching and block extraction should be defined in a new shared registry so the content script can use them directly.

Also document a skill-oriented offline workflow for creating new profiles from HTML fixtures. The extension runtime should not depend on a skill, but the repo should expose a stable profile shape and a fixture-based process so a future skill can inspect HTML, propose selectors/reveal steps, and generate tests or profile stubs.

## Steps
- [x] Add failing tests for site-profile extraction and reveal behavior on Amazon fixtures, while keeping generic fallback coverage intact
- [x] Introduce a shared extraction-profile contract with optional safe reveal steps and profile-based extraction
- [x] Implement an Amazon extraction profile with deterministic block extraction and a safe reveal path for hidden product details in fixtures
- [x] Wire the content-script extraction flow to use matched profiles first and fall back to the generic DOM traversal otherwise
- [x] Document the offline skill workflow and profile contract so new sites can be added from saved HTML fixtures
- [x] Update AGENTS documentation for shared/content areas to reflect profiles, reveal steps, and fallback rules

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- Site profiles will drift as sites change; keeping the generic fallback is mandatory so unsupported layouts still work.
- Reveal steps must stay idempotent and restricted to safe UI expansion. Any step that can mutate cart/account/checkout state is out of scope.
- Amazon has multiple layouts and experiments, so profile selectors should use small fallback lists instead of a single brittle path.
- The skill concept belongs to repo tooling, not the browser runtime. Runtime stability depends on committed profiles and tests, not on live AI inference.
