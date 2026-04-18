# Plan Workflow

Use this workflow whenever the user requests a feature, refactor, migration, structural change, or any task that would modify source files.

## Goal

Produce a decision-complete implementation plan before editing code.

## Rules

- Use the explorer workflow first
- Resolve material ambiguity before planning
- Do not edit source files while planning
- One independently reviewable change should map to one decision file
- Plans must be specific enough that implementation does not require new design decisions

## Decision file location

`.codex/decisions/NNN_short_name.md`

## Required frontmatter

```yaml
---
id: NNN
name: short_name
status: draft
created: YYYY-MM-DD
started:
completed:
depends_on: []
prerequisites:
  env: []
  packages: []
  plans: []
---
```

## Required sections

```markdown
## Why
Why this change exists.

## How
Architecture, data flow, interfaces, constraints, and rollout notes.

## Steps
- [ ] Concrete implementation step 1
- [ ] Concrete implementation step 2

## Test Coverage
Unit, integration, E2E, and any validation that proves the change works.

## Risks / Notes
Known tradeoffs, edge cases, or deviations.
```

## Planning process

1. Use the explorer workflow for every area the change touches
2. Read relevant existing decisions for dependencies and prior art
3. Ask the user only the questions that materially affect the solution
4. Write a decision file with concrete steps, interfaces, and tests
5. Present the plan for approval
6. After approval, set status to `approved`
7. Only then use the implement workflow

## Statuses

`draft -> approved -> in_progress -> review/review_notes -> completed`

Use `blocked` if prerequisites are missing.
