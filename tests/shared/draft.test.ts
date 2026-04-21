import {
  blockKeyFromItem,
  getOrderedItems,
  normalizeDraftDocument,
  reduceDraft,
} from '@/shared/draft';
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

function createSelection(tabId: number, overrides: Partial<SelectionItem> = {}): SelectionItem {
  return {
    id: 'sel_1',
    tabId,
    url: 'https://store.example.com/products/nimbus',
    kind: 'element',
    format: 'paragraph',
    text: 'Cafetera con jarra termica',
    orderKey: '0000.0001',
    selectionKey: 'paragraph:article.product-card:nth-of-type(1)',
    selectorHint: 'article.product-card:nth-of-type(1)',
    createdAt: '2026-04-17T01:00:00.000Z',
    ...overrides,
  };
}

function buildDraftDocument(items: SelectionItem[]): DraftDocument {
  const pageContext = createPageContext();
  return {
    tabId: 4,
    url: pageContext.url,
    origin: pageContext.origin,
    pageTitle: pageContext.pageTitle,
    siteName: pageContext.siteName,
    includeContext: false,
    metadata: {
      title: pageContext.metadata.title ?? pageContext.pageTitle,
      ...pageContext.metadata,
    },
    blocksByKey: Object.fromEntries(items.map((item) => [blockKeyFromItem(item), item])),
    orderedKeys: items.map(blockKeyFromItem),
    items,
    updatedAt: '2026-04-17T01:00:00.000Z',
  };
}

describe('reduceDraft', () => {
  it('inicializa el draft con contexto y agrega selecciones normalizadas', () => {
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
    expect(nextDraft.orderedKeys).toEqual(['paragraph:article.product-card:nth-of-type(1)']);
    expect(nextDraft.blocksByKey[nextDraft.orderedKeys[0] ?? '']?.text).toBe(
      'Cafetera con jarra termica',
    );
    expect(nextDraft.metadata.price).toBe('$89.900');
  });

  it('mantiene el orden interno por orderKey al agregar nodos individuales', () => {
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

    const withFirst = reduceDraft(
      baseDraft,
      {
        type: 'addSelection',
        payload: createSelection(4),
        now: '2026-04-17T01:01:00.000Z',
      },
      pageContext,
    ) as DraftDocument;

    const withSecond = reduceDraft(
      withFirst,
      {
        type: 'addSelection',
        payload: createSelection(4, {
          id: 'sel_2',
          text: 'Precio promocional y envio gratis',
          orderKey: '0000.0002',
          selectionKey: 'paragraph:article.product-card:nth-of-type(2)',
          selectorHint: 'article.product-card:nth-of-type(2)',
        }),
        now: '2026-04-17T01:02:00.000Z',
      },
      pageContext,
    ) as DraftDocument;

    const reorderedByInsert = reduceDraft(
      withSecond,
      {
        type: 'addSelection',
        payload: createSelection(4, {
          id: 'sel_0',
          text: 'Cafetera Nimbus 2L',
          format: 'heading',
          orderKey: '0000.0000',
          selectionKey: 'heading:article.product-card > h1',
          selectorHint: 'article.product-card > h1',
        }),
        now: '2026-04-17T01:03:00.000Z',
      },
      pageContext,
    ) as DraftDocument;

    expect(getOrderedItems(reorderedByInsert).map((item) => item.id)).toEqual([
      'sel_0',
      'sel_1',
      'sel_2',
    ]);
  });

  it('preserva el orden del batch en addSelections cuando ya viene curado por la captura', () => {
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

    const withBatch = reduceDraft(
      baseDraft,
      {
        type: 'addSelections',
        payload: [
          createSelection(4, {
            id: 'sel_heading',
            format: 'heading',
            text: 'Cafetera Nimbus 2L',
            orderKey: '0000.0002',
            selectionKey: 'heading:article.product-card > h1',
            selectorHint: 'article.product-card > h1',
          }),
          createSelection(4, {
            id: 'sel_table',
            format: 'table',
            text: 'Color | Azul',
            orderKey: '0000.0001',
            selectionKey: 'table:section#specs > table',
            selectorHint: 'section#specs > table',
          }),
        ],
        now: '2026-04-17T01:01:00.000Z',
      },
      pageContext,
    ) as DraftDocument;

    expect(getOrderedItems(withBatch).map((item) => item.id)).toEqual(['sel_heading', 'sel_table']);
    expect(withBatch.orderedKeys).toEqual([
      'heading:article.product-card > h1',
      'table:section#specs > table',
    ]);
  });

  it('no colapsa bloques distintos solo porque tienen el mismo texto', () => {
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

    const withBatch = reduceDraft(
      baseDraft,
      {
        type: 'addSelections',
        payload: [
          createSelection(4, {
            id: 'sel_a',
            text: 'Disponible',
            selectionKey: 'paragraph:#availability > span:nth-of-type(1)',
            selectorHint: '#availability > span:nth-of-type(1)',
            orderKey: '0000.0003',
          }),
          createSelection(4, {
            id: 'sel_b',
            text: 'Disponible',
            selectionKey: 'paragraph:#shipping > span:nth-of-type(1)',
            selectorHint: '#shipping > span:nth-of-type(1)',
            orderKey: '0000.0004',
          }),
        ],
        now: '2026-04-17T01:01:00.000Z',
      },
      pageContext,
    ) as DraftDocument;

    expect(getOrderedItems(withBatch).map((item) => item.id)).toEqual(['sel_a', 'sel_b']);
    expect(Object.keys(withBatch.blocksByKey)).toHaveLength(2);
  });

  it('reordena items y agrega notas manuales sobre el modelo normalizado', () => {
    const withItems = buildDraftDocument([
      createSelection(4),
      createSelection(4, {
        id: 'sel_2',
        text: 'Precio promocional y envio gratis',
        selectionKey: 'paragraph:article.product-card:nth-of-type(2)',
        selectorHint: 'article.product-card:nth-of-type(2)',
      }),
    ]);

    const reordered = reduceDraft(
      withItems,
      {
        type: 'reorderSelections',
        orderedIds: ['sel_2', 'sel_1'],
        now: '2026-04-17T01:02:00.000Z',
      },
      createPageContext(),
    ) as DraftDocument;
    const withNote = reduceDraft(
      reordered,
      {
        type: 'upsertNote',
        text: 'Comparar con referencias de Falabella.',
        label: 'Siguiente paso',
        now: '2026-04-17T01:03:00.000Z',
        tabId: 4,
        url: createPageContext().url,
      },
      createPageContext(),
    ) as DraftDocument;

    expect(getOrderedItems(withNote)[0]?.id).toBe('sel_2');
    expect(getOrderedItems(withNote).at(-1)?.kind).toBe('note');
    expect(getOrderedItems(withNote).at(-1)?.label).toBe('Siguiente paso');
  });

  it('migra drafts legacy basados solo en items', () => {
    const legacyDraft = {
      tabId: 4,
      url: 'https://store.example.com/products/nimbus',
      origin: 'https://store.example.com',
      pageTitle: 'Cafetera Nimbus 2L',
      siteName: 'store.example.com',
      includeContext: false,
      metadata: {
        title: 'Cafetera Nimbus 2L',
      },
      items: [createSelection(4)],
      updatedAt: '2026-04-17T01:00:00.000Z',
    } as DraftDocument;

    const normalized = normalizeDraftDocument(legacyDraft) as DraftDocument;

    expect(normalized.orderedKeys).toEqual(['paragraph:article.product-card:nth-of-type(1)']);
    expect(normalized.blocksByKey['paragraph:article.product-card:nth-of-type(1)']?.id).toBe(
      'sel_1',
    );
    expect(normalized.items).toHaveLength(1);
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
