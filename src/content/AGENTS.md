# Content

Área encargada de inyectar el picker sobre la página activa y capturar bloques, texto seleccionado e imágenes.

## Directory Description

Interactúa con el DOM de la página visitada.
No persiste estado de producto ni renderiza la UI del panel lateral.

## File Table

| Path | Description |
| --- | --- |
| `src/content/injectPicker.ts` | Función autocontenida inyectada con `chrome.scripting.executeScript`, responsable de activar el picker manual y de capturar contenido principal segmentado en bloques semánticos desde el DOM activo. |

## Conventions

- El código inyectado debe ser autocontenido; no depender de closures externas.
- Todo payload enviado al background debe salir ya normalizado y filtrado a texto visible.
- Evitar lógica específica de sitio aquí salvo selectors ligeros para metadata.
- Preferir segmentación semántica de contenido principal sobre extracción de contenedores completos cuando el usuario usa la captura rápida.
- Los highlights persistentes del picker deben vivir dentro del runtime inyectado y sincronizarse desde `runPickerAction`, no mediante estado efímero por invocación.

## Usage

```ts
await chrome.scripting.executeScript({
  target: { tabId },
  func: injectPicker,
});
```
