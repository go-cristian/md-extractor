# Shared

Módulos puros o reutilizables entre background, content y side panel.

## Directory Description

Contiene contratos, reducer, generador Markdown, adapters de sitios y helpers de persistencia.
No debe depender de componentes React ni de detalles del DOM inyectado cuando no sea necesario.

## File Table

| Path | Description |
| --- | --- |
| `src/shared/types.ts` | Tipos base del draft, mensajes, formatos semánticos y payloads de captura; el draft normalizado expone `blocksByKey` y `orderedKeys` además del snapshot `items`. |
| `src/shared/draft.ts` | Reducer y helpers del modelo normalizado del draft: identidad estable por `selectionKey`, inclusión explícita por `orderedKeys`, snapshot derivado de `items`, migración lazy desde drafts legacy y flags persistidos como `includeContext`. |
| `src/shared/extractionProfiles.ts` | Perfiles serializables de extracción por sitio, con `reveal` seguro opcional por selector o texto exacto, postproceso Amazon para filtrar ruido comercial/de entrega, supresión de hero image y fusión de tablas key/value del side sheet antes del fallback genérico. |
| `src/shared/markdown.ts` | Generación del archivo Markdown final y de los bloques renderizados para preview, a partir del orden explícito del draft normalizado, con prepend opcional de contexto y sin referencias DOM automáticas. |
| `src/shared/siteAdapters.ts` | Detección Amazon/Shopify y extracción de metadata. |
| `src/shared/selectionUtils.ts` | Normalización de texto, snippets, inferencia conservadora de listas desde texto y limpieza de ruido DOM. |
| `src/shared/storage.ts` | Helpers sobre `chrome.storage.session`. |
| `src/shared/runtime.ts` | Wrapper de mensajería con runtime. |
| `src/shared/id.ts` | IDs livianos para items y notas. |

## Conventions

- Priorizar funciones puras y testeables.
- Los tipos públicos viven aquí y se reutilizan sin duplicación.
- Si una utilidad depende de `chrome.*`, documentar esa restricción de runtime.
- Los bloques seleccionables desde la página deben conservar `selectionKey` estable cuando necesiten toggle o highlight persistente entre content/background/side panel.
- La fuente de verdad del draft es el par `blocksByKey` + `orderedKeys`; `items` existe solo como snapshot derivado de compatibilidad para callers que todavía esperan una lista materializada.
- El orden visible del Markdown debe derivarse de `orderedKeys`; `addSelection` individual puede reinsertar por `orderKey`, pero `addSelections` debe respetar el orden ya curado por la captura automática cuando ese batch llega explícitamente ordenado.
- Si el sidepanel necesita curación por bloque desde el preview, los fragmentos Markdown deben salir de helpers puros en este módulo y seguir el mismo orden que `generateMarkdown`.
- El contexto prepend del Markdown debe salir de metadata ya persistida en el draft; no modelarlo como selección editable.
- Los perfiles por sitio deben ser datos serializables, no closures opacas, porque el picker se ejecuta vía `chrome.scripting.executeScript({ func })` y necesita recibirlos como argumentos.
- Si un sitio expone contenido útil en overlays o summaries pre-renderizados pero ocultos, el perfil debe preferir esos bloques antes que depender de clicks de reveal más frágiles.
- Los `reveal` por texto exacto son válidos solo dentro de perfiles específicos de sitio; deben apuntar a affordances conocidas y nunca a clicks heurísticos globales.
- Para Amazon, el perfil debe combinar `pqv` pre-renderizado con bloques revelados de `#item_details` y `#voyager-ns-desktop-side-sheet-content` cuando existan.
- Para Amazon, `Información importante` puede venir tanto de `pqv` como de `#important-information`; el perfil debe soportar ambas variantes y colapsar headings/subbloques duplicados exactos dentro de esa región.
- Para Amazon, el postproceso debe seguir siendo narrow: filtrar solo ruido conocido de entrega/listas, omitir la hero image automática y fusionar únicamente tablas simples de dos columnas del side sheet `voyager`.
- Los `selectorHint` usados para dedupe y rehighlight deben distinguir hermanos repetidos aunque compartan clase; cuando haya múltiples siblings del mismo tag, conservar `:nth-of-type(...)` incluso si existe `class`.
- El reducer no debe usar dedupe por texto como identidad principal. Si se necesita suprimir duplicados textuales, eso debe ocurrir aguas arriba en la extracción o como postproceso específico por sitio.

## Usage

```ts
import { generateMarkdown } from '@/shared/markdown';
import { reduceDraft } from '@/shared/draft';
```
