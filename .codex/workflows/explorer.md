# Explorer Workflow

Use this workflow **before any codebase exploration**, before writing a plan, and before implementing.

## Rule

Navigate the codebase via `AGENTS.md` files. Never start with raw repo-wide grep/glob searches.

## Process

1. Read the root `AGENTS.md` to understand the project overview and directory table
2. Identify which directory contains what you need from the directory table
3. Navigate to that directory's `AGENTS.md`
4. Continue down the chain until you reach the leaf area relevant to the task
5. Only open source files when the `AGENTS.md` files do not have enough detail

## Rule: keep `AGENTS.md` files fresh

If you discover that an `AGENTS.md` is missing, incomplete, or outdated as part of your work:
- Update it before moving on
- Prefer documenting the area at the directory where the knowledge belongs
- Keep entries short, factual, and implementation-relevant

## When source and `AGENTS.md` disagree

The source of truth is the code. If an `AGENTS.md` is stale:
1. Confirm the code
2. Update the `AGENTS.md`
3. Then continue with the task
