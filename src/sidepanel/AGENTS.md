# Sidepanel

UI React del side panel para controlar la extracción y mostrar el preview Markdown resultante.

## Directory Description

Presenta el estado actual del draft y dispara acciones del usuario.
No decide persistencia ni ejecuta acceso directo al DOM de páginas externas.

## File Table

| Path | Description |
| --- | --- |
| `src/sidepanel/index.html` | Shell HTML del side panel. |
| `src/sidepanel/main.tsx` | Bootstrap de React. |
| `src/sidepanel/App.tsx` | Container con wiring a Chrome APIs y estado, incluyendo copia del Markdown completo, remoción puntual de bloques vía `REMOVE_SELECTION` y cleanup visual del picker al cerrar el panel si estaba activo. |
| `src/sidepanel/SidepanelView.tsx` | Vista presentacional del panel lateral, con header compacto de dos botones visibles y preview Markdown segmentado por bloques removibles. |
| `src/sidepanel/api.ts` | Helpers para mensajes y resolución de pestaña activa. |
| `src/sidepanel/style.css` | Estilos del side panel. |

## Conventions

- Separar container (`App.tsx`) de vista (`SidepanelView.tsx`).
- El preview Markdown siempre se deriva de `src/shared/markdown.ts`.
- Pedir permisos de host por origen desde el side panel antes de intentar inyectar el picker.
- Mantener la UI en español salvo requisito explícito contrario.
- El flujo principal de esta versión es `Activar extracción` -> autoextracción -> curación visual por click. No volver a exponer inventario interno de bloques sin una decisión nueva.
- La UI visible del panel es deliberadamente mínima: controles globales, mensajes de estado y preview Markdown. Labels, drag-reorder, notas y lista de selecciones quedaron fuera del alcance actual.
- El preview puede mostrar el Markdown por bloques para permitir quitar selecciones desde la misma salida, pero no debe evolucionar hacia una lista editorial separada del resultado final.
- El header del panel debe mantener como máximo dos botones visibles en la zona de control: el toggle principal de extracción y una única acción secundaria directa de reextracción. No reintroducir menús de acciones o toggles extra de contexto en esa fila sin una decisión nueva.
- Cerrar el sidepanel mientras la extracción está activa debe disparar el mismo shutdown visual que `Pausar extracción`; eso limpia la página pero no borra el draft.

## Usage

```tsx
import { App } from '@/sidepanel/App';

ReactDOM.createRoot(root).render(<App />);
```
