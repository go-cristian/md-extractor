# md-extractor

Extensión Chrome MV3 para capturar contenido de páginas de producto y convertirlo en Markdown editable por bloques.

## Qué hace

- captura bloques desde la página activa con un picker manual
- deja las selecciones visibles en la página con highlight persistente
- permite reordenar, renombrar y borrar bloques desde el side panel
- genera un preview Markdown listo para copiar
- puede agregar un bloque de `Contexto` al inicio del Markdown con metadata de la página

## Stack

- Chrome Extension Manifest V3
- React 19
- TypeScript estricto
- Vite 8 + CRXJS
- Vitest + React Testing Library
- Playwright para E2E
- Biome + Oxlint
- `pnpm`

## Desarrollo

Instalación:

```bash
pnpm install
pnpm exec playwright install chromium
```

Modo desarrollo:

```bash
pnpm dev
```

Build:

```bash
pnpm build
```

Checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

## Cargar la extensión en Chrome

1. Corre `pnpm build`
2. Abre `chrome://extensions`
3. Activa `Developer mode`
4. Haz click en `Load unpacked`
5. Selecciona la carpeta `dist/`

## Flujo de uso

1. Abre una página de producto
2. Abre el side panel de la extensión
3. Activa el picker
4. Haz click en títulos, textos, listas, tablas o imágenes para agregarlos
5. Haz click otra vez sobre un bloque ya seleccionado para quitarlo
6. Ordena y edita etiquetas desde el side panel
7. Usa `Agregar contexto` si quieres prepend de metadata al Markdown
8. Copia el Markdown final

## Estructura

| Path | Descripción |
| --- | --- |
| `src/background/` | Service worker MV3, mensajes y persistencia por pestaña |
| `src/content/` | Picker inyectado sobre la página activa |
| `src/sidepanel/` | UI React del side panel |
| `src/shared/` | Tipos, reducer, markdown, adapters y utilidades |
| `tests/` | Unit tests y RTL |
| `tests/fixtures/` | HTML estático para pruebas |
| `e2e/` | Pruebas Playwright de la extensión |
| `.codex/` | Workflows, decisiones y políticas del repo |

## Reglas del repo

Este repo usa un flujo de decisiones en `.codex/decisions/` y documentación operativa en `AGENTS.md`.

Antes de cambiar comportamiento:

1. explora desde `AGENTS.md`
2. crea o actualiza una decisión
3. implementa con tests
4. deja la decisión en `review` o `completed`

## Estado actual del flujo

- picker manual: activo
- highlight persistente: activo
- captura principal desde UI: removida
- contexto prepend en Markdown: activo vía toggle
