---
id: 024
name: reset_draft_on_page_navigation
status: completed
created: 2026-04-20
started: 2026-04-20
completed: 2026-04-20
depends_on:
  - 019
  - 022
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
When the active page reloads or navigates to a different page, the picker runtime is reset by the browser, but the extension keeps the previous draft in `chrome.storage.session` under the same `tabId`. The side panel can therefore keep showing selections from the previous page, and activating extraction again can reapply stale highlights or stale Markdown before the user explicitly re-extracts.

The expected behavior for a page reload or navigation is a fresh extraction state: no previous selections, no active picker, and no old preview content tied to the prior page load.

## How
Treat a tab navigation/reload as an extraction-session boundary.

- Add a background helper that resets extraction state for a tab by clearing its draft, setting picker state to inactive, and best-effort syncing an empty highlight payload to the injected runtime.
- Call that helper from `chrome.tabs.onUpdated` when navigation starts (`changeInfo.status === 'loading'`) or when Chrome reports a URL change (`changeInfo.url != null`). This covers ordinary reloads, full navigations, and same-tab URL changes where the injected runtime may still exist briefly.
- Keep `STOP_PICKER` behavior unchanged: pausing extraction or closing the side panel remains visual-only and preserves the draft, because that is not a page navigation.
- Add a defensive `LOAD_DRAFT` guard that compares the stored draft URL with the current tab URL. If they differ, clear the stale draft and return `draft: null` with the current picker state. This protects the side panel if a navigation event was missed or arrives before the panel refreshes.
- Leave `START_PICKER` auto-capture semantics intact. After the reset, activating extraction will seed a fresh draft for the current page.

## Steps
- [x] Add E2E coverage proving a page reload clears the old preview/highlights and activation extracts a fresh draft.
- [x] Add E2E coverage proving same-tab navigation to another fixture does not keep the previous page selection.
- [x] Update the background tab-update and `LOAD_DRAFT` handling to reset stale per-tab extraction state on reload/navigation.
- [x] Run targeted verification, then full project checks.

## Test Coverage
- E2E for reload reset using `generic-product.html`.
- E2E for same-tab navigation from `generic-product.html` to `generic-product-alt.html`.
- Full verification:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm test:e2e`

## Risks / Notes
- This intentionally changes persistence semantics: drafts still persist when the panel is closed or extraction is paused, but no longer survive a page reload or navigation in the same tab.
- Clearing on `loading` means a manual browser refresh of the same URL discards the previous draft even if the content would be identical. That matches the requested behavior and avoids stale selection confusion.
- The highlight sync during navigation is best effort because the document may already be unloading.
