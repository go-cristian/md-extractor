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

## Usage

```ts
await chrome.runtime.sendMessage({ type: 'START_PICKER', tabId });
await chrome.runtime.sendMessage({ type: 'CAPTURE_PRIMARY_CONTENT', tabId });
```
