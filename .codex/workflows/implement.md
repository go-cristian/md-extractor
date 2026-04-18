# Implement Workflow

Use this workflow only after a matching decision file has status `approved`.

## Phase 1 — Validate prerequisites

Before editing code, confirm:

1. A matching `.codex/decisions/NNN_*.md` file exists
2. Its status is `approved`
3. Any listed prerequisites are satisfied
4. You have used the explorer workflow for every area the change touches

If any check fails:
- Set plan status to `blocked`
- Tell the user what is missing
- Stop

## Phase 2 — Explore (required, not optional)

Use the explorer workflow to read `AGENTS.md` files for every area this implementation touches.

Goal: know what imports, types, patterns, and conventions exist **before writing line 1**. This eliminates trial-and-error.

## Phase 3 — TDD loop (one step at a time)

For each step in the decision's `## Steps` checklist:

1. Review context from Phase 2
2. Write failing tests first
3. Implement the minimum code to make the tests pass
4. Run the relevant tests for that step
5. Check off the step in the decision file
6. Move to the next step

Never skip the failing-test step. Never mark a step done until tests pass.

## Phase 4 — Full verification

Before setting status to `review`, run all project checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

Fix any failures before proceeding.

## Phase 5 — Update `AGENTS.md` files

For every area modified:
- New files -> add them to that area's `AGENTS.md`
- New exports -> add them to usage or exports sections
- New routes -> add them to the routes table
- New types -> add them to the documented contracts

`AGENTS.md` files must reflect the new state of the code.

## Phase 6 — Mark review, wait for approval

Set decision status to `review` (or `review_notes` if you had to deviate from the plan).

Do not commit. Wait for user review and approval.

## Phase 7 — Commit (only after user approves)

Create a single commit covering the change. Message format:

```text
feat: [short description of what was built]
```

Set decision status to `completed`.

## Status transitions

`approved -> in_progress -> review -> completed`

`approved -> in_progress -> review_notes -> completed`
