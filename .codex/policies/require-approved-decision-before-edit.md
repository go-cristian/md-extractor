# Policy: Require approved decision before editing source files

## Description

Block source-file editing in the declared source roots unless an approved decision document exists for the current work.

## Scope

Applies to source files under `src/`. Does not apply to `AGENTS.md`, `.codex/`, or other documentation-only changes.

## Rule

Before editing source files, there must be a `.codex/decisions/NNN_*.md` file with status:
- `approved`
- `in_progress`
- `review`
- `review_notes`

For the initial repository bootstrap, `001_project_scaffold.md` is the allowed exception.

## Action when blocked

If no matching decision exists:
1. Stop editing source files
2. Tell the user to use the plan workflow first
3. Create or update the relevant decision file
4. Continue only after approval

## Message when blocked

"Blocked: no approved decision covers this source change. Use `.codex/workflows/plan.md`, get approval, create/update the matching decision, and then continue with implementation."
