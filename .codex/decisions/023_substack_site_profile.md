---
id: 023
name: substack_site_profile
status: completed
created: 2026-04-20
started: 2026-04-20
completed: 2026-04-20
depends_on:
  - 012
  - 019
  - 022
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The extractor is now strong enough on commerce pages and needs a second profile family for editorial content. Substack is a high-value target because posts are structurally rich, publicly accessible, and noisy enough that the generic fallback will over-capture publication chrome, subscribe prompts, comments, and recommendation widgets.

## How
Add a dedicated `substack` extraction profile to `src/shared/extractionProfiles.ts` that targets public post pages, not publication homepages. The profile should prefer the canonical post article and ignore signup, app-promo, recommendation, and comment affordances.

Reference signals observed on a public Substack post:

- post root: `article.typography.newsletter-post.post`
- post title: `h1.post-title.published`
- publication title often appears as a separate earlier `h1`, so the profile must anchor to the post title rather than the first heading in the document
- metadata wrapper: `.byline-wrapper`
- action noise includes `Subscribe`, `Sign in`, share counts, comments links, recommendation cards, and app/download prompts

Initial extraction scope for Substack should include:

- post title as `#`
- optional subtitle/dek when present
- author/date line if it can be captured cleanly without action noise
- main article paragraphs in document order
- semantic lists inside the post body
- inline images or figures only when they belong to the post article
- headings inside the article body

The profile should explicitly avoid:

- publication masthead heading
- subscribe/sign-in CTAs
- share/comment/reaction controls
- related/recommended posts
- footer/app/download prompts
- comments thread

This slice should start with one real public Substack post fixture added under `tests/fixtures/`, then unit tests for the shared profile, and one E2E route served from the local fixture server. No reveal is expected in the first Substack slice unless the fixture proves a critical content region is collapsed by default.

## Steps
- [x] Add a real Substack post fixture and failing tests that define the desired Markdown shape and the main noise to exclude
- [x] Implement a `substack` site extraction profile anchored to the canonical post title/article root, with narrow noise filtering and body extraction in document order
- [x] Add E2E coverage for activating extraction on the Substack fixture and run full verification

## Test Coverage
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- Substack custom domains and `*.substack.com` pages may share structure but not hostname patterns, so the profile should rely on both hostnames and DOM signals.
- The publication masthead can look like content if the profile is not anchored tightly to the post title/article container.
- Some Substack posts include paid-content gates; this first slice should target public posts only.
