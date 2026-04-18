# md-extractor

Extensión Chrome MV3 para capturar contenido de páginas de compra y convertirlo en Markdown editable por bloques.

## Stack

- Chrome Extension Manifest V3
- React 19 + TypeScript estricto
- Vite 8 + CRXJS
- Vitest + React Testing Library
- Playwright para E2E de extensión
- Biome + Oxlint
- `pnpm` como package manager

## Directory Table

| Path | Description |
| --- | --- |
| `src/background/` | Service worker que coordina side panel, picker y persistencia. |
| `src/content/` | Inyección del picker sobre la página activa. |
| `src/sidepanel/` | UI React del panel lateral. |
| `src/shared/` | Tipos, reducer, Markdown, adapters y utilidades compartidas. |
| `tests/` | Setup y pruebas unitarias/RTL. |
| `tests/fixtures/` | HTML estático para adapters y pruebas de integración. |
| `e2e/` | Pruebas Playwright de la extensión. |
| `.codex/` | Workflows, decisiones, políticas y plantillas repo-locales. |

## AI Development System

This project uses a structured AI development workflow. **You MUST follow these repo workflows — they are not optional.**

### Workflows

| Workflow | When to use | Required? |
|----------|-------------|-----------|
| `.codex/workflows/explorer.md` | **Before any codebase exploration.** Navigate via `AGENTS.md` files — do not start with raw repo-wide grep/glob. | Always |
| `.codex/workflows/plan.md` | Create decision documents (numbered like migrations) and get approval before implementation. | Before implementation |
| `.codex/workflows/implement.md` | Execute an approved decision using TDD and full verification. | For feature work |

**Explorer is the entry point for all codebase understanding.** When asked how something works, where something lives, or to understand existing code: start from the nearest relevant `AGENTS.md` and follow the directory chain. Only read source files when `AGENTS.md` does not answer the question.

### Decisions

Architectural and implementation decisions are tracked in `.codex/decisions/` as numbered files (like DB migrations). Numbers are sequential and permanent. See `.codex/workflows/plan.md` for the format.

### Guardrail

Do not edit source files in the declared source roots unless a matching decision file exists with `status: approved`, `in_progress`, `review`, or `review_notes`, except for the initial scaffold task documented in `001_project_scaffold.md`.

## Dev Environment Setup

```bash
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

## Conventions

- TypeScript sin `any`; preferir tipos explícitos y unions discriminadas.
- Toda mutación del draft debe pasar por el reducer en `src/shared/draft.ts`.
- El side panel es la UI principal; no introducir popup salvo necesidad real de producto.
- Mantener el picker genérico y degradar elegantemente si no hay selectors específicos por sitio.
- Documentar cambios estructurales en el `AGENTS.md` del área afectada.
- Usar pruebas unitarias para lógica pura, RTL para UI, Playwright para flujos reales de la extensión.
