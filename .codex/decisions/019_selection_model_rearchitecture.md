---
id: 019
name: selection_model_rearchitecture
status: completed
created: 2026-04-20
started: 2026-04-20
completed: 2026-04-20
depends_on:
  - 011
  - 012
  - 016
  - 018
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The extractor already has the right user-facing workflow, but its internal selection model is carrying too much implicit behavior. Today the system spreads core semantics across several fields and layers:

- stable identity for toggling is inferred from `selectionKey`
- DOM location is carried separately in `orderKey`
- visual rehighlighting depends on `selectorHint`
- persisted records still get an unrelated generated `id`
- batch dedupe in the draft reducer falls back to normalized text signatures instead of the selection identity used by page toggles

That split has been workable for incremental slices, but it is now the main source of structural ambiguity. It makes it harder to reason about why a block is included or excluded, whether two blocks are really the same block, and which layer is authoritative for final ordering. Continuing to add feature slices on top of this model will increase accidental coupling between content extraction, background toggles, draft persistence, and Markdown rendering.

The next improvement should therefore be architectural, not another site-specific patch: make selection identity, inclusion, and ordering explicit in the persisted model, then adapt the existing extractor workflow to that model without changing the current MVP UX.

## How
Re-architect the draft around an explicit ordered-set model for selections.

### New mental model
The persisted draft should answer three separate questions directly:

1. What blocks are known for this page?
2. Which of those blocks are currently included in the Markdown?
3. In what order should included blocks appear?

Instead of encoding all three answers implicitly in `draft.items`, introduce a normalized structure:

- `blocksByKey: Record<string, SelectionBlock>`
  - canonical payload for each captured block keyed by stable block identity
- `orderedKeys: string[]`
  - the current included set, in final Markdown order
- optional compatibility helpers for derived item arrays while the migration is in progress

`SelectionBlock` should keep the existing semantic payload (`format`, `text`, `table`, `imageUrl`, `headingLevel`, `selectorHint`, `orderKey`, etc.), but the stable identity must be the first-class key. The generated `id` can be retained only as a compatibility field for temporary UI callers if necessary, but it should stop being the primary identity for selection logic.

### Stable identity contract
Use `selectionKey` as the canonical block key. It already exists and is the right abstraction for persistent toggle semantics because it is derived from block type plus stable DOM position hints. The model should make this explicit:

- every non-note block persisted in the draft must have a `selectionKey`
- `selectionKey` becomes the required key for all capture payloads, toggles, inclusion checks, and highlight sync
- `selectorHint` remains for DOM lookup/highlight sync only
- `orderKey` remains for deterministic document order calculations and profile anchoring, but not as identity

This reduces the current ambiguity where text dedupe, generated ids, and derived keys can each act like “identity” depending on code path.

### Inclusion and ordering rules
`orderedKeys` becomes the source of truth for final Markdown order.

Rules:
- auto-capture inserts keys in the explicit order emitted by the capture pipeline
- click re-addition restores the block at its DOM-consistent place by comparing `orderKey`, not click time
- toggling off removes the key from `orderedKeys` but keeps the block payload in `blocksByKey` only if that retained knowledge is useful for later reactivation; otherwise removal can stay destructive in this first pass
- any rendering or highlight sync that needs the active included blocks derives them by iterating `orderedKeys`

This keeps the user-facing behavior unchanged while making the ordering model explicit and reviewable.

### Reducer responsibilities
Refactor `src/shared/draft.ts` so the reducer operates on ordered-set semantics instead of array mutation semantics.

That means:
- `addSelection` inserts by `selectionKey` and canonical order policy
- `addSelections` performs batch upsert keyed by `selectionKey`, preserving the incoming batch order when it is already curated by the extractor
- `removeSelection` removes by `selectionKey` (with an adapter for existing UI/background callers during migration)
- batch dedupe by normalized text should stop being the primary correctness mechanism

Text-based duplicate suppression can still exist as a narrow extractor-level cleanup if a site genuinely renders the same block twice, but it should no longer be the reducer’s generic identity mechanism.

### Background and content flow
Keep the current user-visible flow:
- `Activar extracción`
- `Extraer de nuevo`
- click-to-toggle on page
- preview-only side panel

But make the internals use the normalized model end to end:

- the content script always emits `selectionKey`, `orderKey`, and `selectorHint`
- the background toggles inclusion by `selectionKey`
- highlight sync derives from `orderedKeys -> blocksByKey`
- Markdown generation derives from the active ordered keys, not from raw `items`

The content script should not need to know whether the persisted draft is normalized. Its job remains to emit stable block payloads. The background and reducer become the only place that decides inclusion and order persistence.

### Migration strategy
Do not attempt a big-bang rewrite.

Implement this in one reviewable slice with compatibility shims:

1. introduce normalized draft shape in types and reducer
2. add adapters that can still answer existing callers expecting an item list where needed
3. migrate background handlers and highlight sync to the new shape
4. migrate Markdown generation to derive from normalized inclusion order
5. remove obsolete text-signature dedupe and id-based assumptions once tests prove parity

If keeping full backward compatibility inside the same type becomes too messy, it is acceptable to define a new draft schema and migrate stored drafts lazily on load from `chrome.storage.session`.

### Scope guardrails
This slice is deliberately structural. It should not:
- change visible sidepanel UX
- reintroduce selection inventory UI
- expand site-profile capabilities
- change the Amazon-specific filtering/reveal behavior except where the new draft model requires wiring updates

## Steps
- [x] Add failing tests that expose current identity/order ambiguity: batch dedupe collisions, re-add ordering, toggle-by-key semantics, and markdown derivation from explicit ordered inclusion
- [x] Introduce a normalized draft model keyed by `selectionKey`, with explicit ordered inclusion and a migration path from the current array-based shape
- [x] Refactor the reducer to use ordered-set semantics for add/remove/restart flows and remove text-signature dedupe as the primary identity rule
- [x] Update background handlers and picker highlight sync to operate on canonical block keys instead of implicit item-array presence
- [x] Update Markdown generation and any remaining callers to derive output from the normalized ordered inclusion model
- [x] Refresh shared/background/content AGENTS docs and run full verification

## Test Coverage
- Unit tests for reducer migration, add/remove/toggle semantics, ordered insertion, and duplicate-key handling
- Unit tests for Markdown generation from normalized drafts
- Integration tests for background toggle flows and highlight payload derivation
- Targeted E2E coverage confirming that auto-capture order, click removal/re-addition, and Amazon profile output remain behaviorally stable after the refactor
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

## Risks / Notes
- This is a structural change to the persistence model. The main risk is breaking existing flows that still assume `draft.items` is the sole source of truth.
- Lazy migration on load is safer than trying to support two independent persistent shapes indefinitely.
- If a site emits unstable selector hints, `selectionKey` stability will still suffer. This slice improves the model but does not replace the need for careful selector generation in the content script.
- Keeping generated ids around purely for compatibility is acceptable temporarily, but the refactor should end with `selectionKey` as the unambiguous selection identity.
