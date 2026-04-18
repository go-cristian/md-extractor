import { reduceDraft } from '@/shared/draft';
import type { DraftDocument, PageContextPayload, SelectionItem } from '@/shared/types';

function createPageContext(): PageContextPayload {
  return {
    url: 'https://store.example.com/products/nimbus',
    origin: 'https://store.example.com',
    pageTitle: 'Cafetera Nimbus 2L',
    siteName: 'store.example.com',
    metadata: {
      title: 'Cafetera Nimbus 2L',
      price: '$89.900',
    },
  };
}

function createSelection(tabId: number): SelectionItem {
  return {
    id: 'sel_1',
    tabId,
    url: 'https://store.example.com/products/nimbus',
    kind: 'element',
    format: 'paragraph',
    text: 'Cafetera con jarra termica',
    createdAt: '2026-04-17T01:00:00.000Z',
    selectorHint: 'article.product-card',
  };
}

describe('reduceDraft', () => {
  it('inicializa el draft con contexto y agrega selecciones', () => {
    const pageContext = createPageContext();
    const withContext = reduceDraft(
      null,
      {
        type: 'mergePageContext',
        payload: pageContext,
        now: '2026-04-17T01:00:00.000Z',
      },
      pageContext,
    );

    expect(withContext).not.toBeNull();
    const nextDraft = reduceDraft(
      withContext,
      {
        type: 'addSelection',
        payload: createSelection(4),
        now: '2026-04-17T01:01:00.000Z',
      },
      pageContext,
    ) as DraftDocument;

    expect(nextDraft.items).toHaveLength(1);
    expect(nextDraft.metadata.price).toBe('$89.900');
  });

  it('reordena items y agrega notas manuales', () => {
    const pageContext = createPageContext();
    const baseDraft = reduceDraft(
      null,
      {
        type: 'mergePageContext',
        payload: pageContext,
        now: '2026-04-17T01:00:00.000Z',
      },
      pageContext,
    ) as DraftDocument;

    const withItems = {
      ...baseDraft,
      items: [
        createSelection(4),
        {
          ...createSelection(4),
          id: 'sel_2',
          text: 'Precio promocional y envio gratis',
        },
      ],
    } satisfies DraftDocument;

    const reordered = reduceDraft(
      withItems,
      {
        type: 'reorderSelections',
        orderedIds: ['sel_2', 'sel_1'],
        now: '2026-04-17T01:02:00.000Z',
      },
      pageContext,
    ) as DraftDocument;
    const withNote = reduceDraft(
      reordered,
      {
        type: 'upsertNote',
        text: 'Comparar con referencias de Falabella.',
        label: 'Siguiente paso',
        now: '2026-04-17T01:03:00.000Z',
        tabId: 4,
        url: pageContext.url,
      },
      pageContext,
    ) as DraftDocument;

    expect(withNote.items[0]?.id).toBe('sel_2');
    expect(withNote.items.at(-1)?.kind).toBe('note');
    expect(withNote.items.at(-1)?.label).toBe('Siguiente paso');
  });

  it('togglea el prepend de contexto en el draft', () => {
    const pageContext = createPageContext();
    const baseDraft = reduceDraft(
      null,
      {
        type: 'mergePageContext',
        payload: pageContext,
        now: '2026-04-17T01:00:00.000Z',
      },
      pageContext,
    ) as DraftDocument;

    const withContext = reduceDraft(baseDraft, {
      type: 'toggleIncludeContext',
      now: '2026-04-17T01:01:00.000Z',
    }) as DraftDocument;
    const withoutContext = reduceDraft(withContext, {
      type: 'toggleIncludeContext',
      now: '2026-04-17T01:02:00.000Z',
    }) as DraftDocument;

    expect(withContext.includeContext).toBe(true);
    expect(withoutContext.includeContext).toBe(false);
  });
});
