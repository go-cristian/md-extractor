# Tests

Pruebas unitarias, RTL y fixtures estáticos del extractor.

## Directory Description

Esta carpeta cubre lógica pura y UI local sin lanzar Chromium.
Los fixtures HTML aquí deben ser estables y preferiblemente estáticos; si una captura real trae scripts de terceros, sanitizarla antes de versionarla para que no rehidrate o mutile el DOM durante las pruebas.

## File Table

| Path | Description |
| --- | --- |
| `tests/fixtures/` | HTML estático usado por adapters, perfiles por sitio y pruebas de integración ligera. |
| `tests/shared/` | Unit tests de reducer, markdown y perfiles de extracción. |
| `tests/sidepanel/` | RTL del side panel React. |
| `tests/setup.ts` | Setup global de Vitest/RTL. |

## Conventions

- Cada perfil por sitio nuevo debe entrar primero con un fixture real aquí y una prueba unitaria que fije inclusiones y exclusiones.
- Los fixtures de sitios de terceros deben recortarse o sanearse si scripts externos cambian el DOM en runtime.
- Cuando una aserción dependa de casing visual del navegador, preferir checks robustos a `text-transform` para no divergir entre DOMParser y Chromium.
