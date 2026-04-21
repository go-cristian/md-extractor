# Content

Área encargada de inyectar el picker sobre la página activa y capturar bloques semánticos del DOM.

## Directory Description

Interactúa con el DOM de la página visitada.
No persiste estado de producto ni renderiza la UI del panel lateral.

## File Table

| Path | Description |
| --- | --- |
| `src/content/injectPicker.ts` | Función autocontenida inyectada con `chrome.scripting.executeScript`, responsable de intentar primero perfiles por sitio con `reveal` seguro por selector o texto exacto, reflejar el mismo postproceso por perfil que la capa shared (Amazon y Substack), caer al fallback genérico cuando haga falta, sincronizar highlights persistentes y permitir toggles por click sobre bloques semánticos. |

## Conventions

- El código inyectado debe ser autocontenido; no depender de closures externas.
- Todo payload enviado al background debe salir ya normalizado y filtrado a texto visible.
- Evitar lógica específica de sitio aquí salvo selectors ligeros para metadata.
- La activación del picker debe poder sembrar una autoextracción inicial desde `document.body`, en orden de documento y sin depender de detectar cuándo terminó de cargar la página.
- Si hay perfiles por sitio, el picker debe evaluarlos primero y solo usar el fallback genérico cuando ningún perfil aplique o cuando el perfil no produzca bloques útiles.
- Un perfil puede extraer desde DOM oculto pero ya pre-renderizado, como popovers preload o quick views, siempre que eso reduzca ruido frente a la página visible.
- Los `reveal` deben seguir siendo programáticos y acotados: clicks por selector o texto exacto sobre affordances conocidas, más normalización explícita de targets si el fixture o layout no ejecuta handlers reales.
- Reutilizar la misma clasificación de nodos para la autoextracción y para el toggle manual por click; si divergen, aparecerán duplicados o selecciones imposibles de reactivar.
- No reintroducir drag o text-range capture sin una decisión nueva; esta versión es click-only.
- Los highlights persistentes del picker deben vivir dentro del runtime inyectado y sincronizarse desde `runPickerAction`, no mediante estado efímero por invocación.
- La desactivación del picker debe limpiar los artefactos visuales de la página (`data-md-extractor-selected`, overlay visible y cursor), sin destruir el estado persistido en background.
- Como `runPickerAction` se serializa al inyectarse, cualquier perfil por sitio debe entrar como dato serializable; no depender de imports runtime dentro del cuerpo inyectado.
- El runtime del picker debe reflejar cualquier postproceso de perfiles críticos como Amazon: mismo filtro de ruido, misma supresión de hero image y misma fusión de tablas `voyager`, para que el preview real no diverja de `extractWithSiteProfile`.
- Cuando Amazon exponga `Información importante` tanto en `pqv` como en `#important-information`, el runtime debe deduplicar headings/subsecciones repetidas exactas dentro de esa región para que el Markdown no duplique disclaimers ni subtítulos.
- Cuando Substack aplique, el runtime debe trabajar sobre el artículo canónico y mantener el mismo filtro de subscribe/share/comments y CTA final que la capa shared; si divergen, el preview del sidepanel mostrará ruido que no aparece en unit tests.
- Cuando un `selectorHint` sirva para dedupe o highlights de nodos repetidos, debe conservar `:nth-of-type(...)` aunque la clase sea compartida; de lo contrario Amazon colapsa tablas hermanas válidas.
- Todo bloque emitido desde la página debe traer `selectionKey`, `selectorHint` y `orderKey` coherentes entre sí; el background usa esa triple relación para persistencia, reactivación y rehighlighting sobre el draft normalizado.

## Usage

```ts
await chrome.scripting.executeScript({
  target: { tabId },
  func: injectPicker,
});
```
