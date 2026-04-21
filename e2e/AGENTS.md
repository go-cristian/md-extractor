# E2E

Pruebas Playwright de la extensión MV3 contra fixtures servidos localmente.

## Directory Description

Aquí viven los flujos completos: página fixture, service worker, side panel y picker inyectado.

## File Table

| Path | Description |
| --- | --- |
| `e2e/extension.spec.ts` | Suite principal de Playwright con servidor HTTP local de fixtures y helpers para abrir el side panel, activar extracción y validar el preview Markdown. |

## Conventions

- Todo fixture nuevo usado por E2E debe mapearse en `fixtureMap` y servirse desde `tests/fixtures/`.
- Si un HTML de terceros incluye scripts que rehidratan la página, sanear el fixture antes de usarlo en E2E; de lo contrario el test valida la app del tercero, no el extractor.
- Mantener los asserts centrados en el Markdown visible y en los highlights sincronizados, no en detalles cosméticos del DOM original.
