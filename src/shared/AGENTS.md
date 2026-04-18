# Shared

Módulos puros o reutilizables entre background, content y side panel.

## Directory Description

Contiene contratos, reducer, generador Markdown, adapters de sitios y helpers de persistencia.
No debe depender de componentes React ni de detalles del DOM inyectado cuando no sea necesario.

## File Table

| Path | Description |
| --- | --- |
| `src/shared/types.ts` | Tipos base del draft, mensajes, formatos semánticos, payloads de captura principal y adapters. |
| `src/shared/draft.ts` | Reducer y creación del documento base, incluyendo altas en lote para capturas segmentadas y flags persistidos del draft como `includeContext`. |
| `src/shared/markdown.ts` | Generación del archivo Markdown final a partir de bloques semánticos, con prepend opcional de contexto y sin referencias DOM automáticas. |
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
- El contexto prepend del Markdown debe salir de metadata ya persistida en el draft; no modelarlo como selección editable.

## Usage

```ts
import { generateMarkdown } from '@/shared/markdown';
import { reduceDraft } from '@/shared/draft';
```
