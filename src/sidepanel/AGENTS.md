# Sidepanel

UI React del side panel para gestionar selecciones, notas, orden final y preview Markdown.

## Directory Description

Presenta el estado actual del draft y dispara acciones del usuario.
No decide persistencia ni ejecuta acceso directo al DOM de páginas externas.

## File Table

| Path | Description |
| --- | --- |
| `src/sidepanel/index.html` | Shell HTML del side panel. |
| `src/sidepanel/main.tsx` | Bootstrap de React. |
| `src/sidepanel/App.tsx` | Container con wiring a Chrome APIs y estado. |
| `src/sidepanel/SidepanelView.tsx` | Vista presentacional del panel lateral. |
| `src/sidepanel/api.ts` | Helpers para mensajes y resolución de pestaña activa. |
| `src/sidepanel/style.css` | Estilos del side panel. |

## Conventions

- Separar container (`App.tsx`) de vista (`SidepanelView.tsx`).
- El preview Markdown siempre se deriva de `src/shared/markdown.ts`.
- Pedir permisos de host por origen desde el side panel antes de intentar inyectar el picker.
- Mantener la UI en español salvo requisito explícito contrario.
- El flujo principal de esta versión es picker manual + toggle de contexto; no reexponer captura principal desde la UI sin una decisión nueva.

## Usage

```tsx
import { App } from '@/sidepanel/App';

ReactDOM.createRoot(root).render(<App />);
```
