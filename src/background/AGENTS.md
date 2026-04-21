# Background

Service worker MV3 responsable de wiring con Chrome APIs, persistencia por pestaña y coordinación entre side panel y picker.

## Directory Description

Hace orquestación y side effects de extensión.
No contiene UI React ni lógica de render de Markdown.

## File Table

| Path | Description |
| --- | --- |
| `src/background/main.ts` | Registro de listeners Chrome, manejo de mensajes y persistencia del draft. |

## Conventions

- Toda operación que escriba en `chrome.storage.session` pasa por helpers de `src/shared/storage.ts`.
- No duplicar tipos de mensajes; importarlos desde `src/shared/types.ts`.
- Mantener handlers pequeños y mover lógica pura a `src/shared/`.
- La resíncronización del picker sobre la página activa debe hacerse con `chrome.scripting.executeScript` y `runPickerAction`, para reutilizar el runtime inyectado.
- Los toggles persistidos del draft, como `includeContext`, se resuelven en background y se guardan por pestaña igual que el resto del documento.
- El background debe tratar `selectionKey` como identidad canónica de los bloques activos; no volver a deducir igualdad por texto normalizado ni por ids efímeros.
- Para cualquier operación derivada del contenido activo del draft, iterar el orden explícito (`orderedKeys` materializado) en vez de asumir que `draft.items` es la única fuente de verdad.
- `START_PICKER` es también la puerta de entrada de la autoextracción: si no hay draft curado para la URL actual, debe sembrarlo antes de dejar el picker activo.
- `RESTART_EXTRACTION` siempre regenera el draft desde cero para la página actual; `CLEAR_DRAFT` solo borra estado y highlights, sin volver a extraer.
- `STOP_PICKER` debe comportarse como shutdown visual del runtime inyectado: limpiar overlay/cursor/highlights de la página, pero preservar el draft persistido.
- Las recargas y navegaciones de una pestaña son frontera de sesión: deben limpiar draft, highlights y estado activo para no mezclar selecciones de la página anterior.
- Cuando exista un registry de perfiles por sitio, el background debe pasar esos perfiles serializables al picker inyectado como argumentos de `executeScript`, no asumir que el runtime inyectado puede resolver imports externos.

## Usage

```ts
await chrome.runtime.sendMessage({ type: 'START_PICKER', tabId });
await chrome.runtime.sendMessage({ type: 'CAPTURE_PRIMARY_CONTENT', tabId });
```
