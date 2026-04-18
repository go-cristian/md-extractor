---
id: 002
name: runtime_host_permissions
status: review_notes
created: 2026-04-17
started: 2026-04-17
completed:
depends_on:
  - 001
prerequisites:
  env: []
  packages: []
  plans: []
---

## Why
The picker cannot inject into real ecommerce hosts such as Amazon because the manifest only grants access to local fixture hosts.

## How
Add optional host permissions for `http` and `https`, request access for the active tab origin from the side panel under user gesture, and keep localhost fixture hosts granted for automated tests. Surface a clearer error if injection still fails.

## Steps
- [x] Add optional runtime host permissions to the manifest without broad install-time host access
- [x] Request and validate per-origin access from the side panel before starting the picker
- [x] Add tests for the permission helper and preserve existing checks

## Test Coverage
- Unit tests for origin pattern resolution and runtime permission request behavior
- Existing extension and side panel tests

## Risks / Notes
- `chrome.permissions.request` only works for requestable origins and requires a user gesture, so the request must stay on the picker activation path.
- `pnpm typecheck`, `pnpm lint` and `pnpm test` are green. `pnpm test:e2e` rebuilds successfully and passes the first three extension flows, but the two metadata-focused Playwright cases still hang after the third test and need separate follow-up.
