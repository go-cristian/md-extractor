import { createId } from '@/shared/id';
import { normalizeOptionalText, normalizeText } from '@/shared/selectionUtils';
import type { DraftAction, DraftDocument, PageContextPayload, SelectionItem } from '@/shared/types';

export function createEmptyDraft(
  pageContext: PageContextPayload,
  tabId: number,
  now: string,
): DraftDocument {
  return {
    tabId,
    url: pageContext.url,
    origin: pageContext.origin,
    pageTitle: pageContext.pageTitle,
    siteName: pageContext.siteName,
    includeContext: false,
    metadata: {
      title: pageContext.metadata.title ?? pageContext.pageTitle,
      ...pageContext.metadata,
    },
    items: [],
    updatedAt: now,
  };
}

function updateMetadata(
  current: DraftDocument,
  pageContext: PageContextPayload,
  now: string,
): DraftDocument {
  return {
    ...current,
    url: pageContext.url,
    origin: pageContext.origin,
    pageTitle: pageContext.pageTitle,
    siteName: pageContext.siteName,
    includeContext: current.includeContext ?? false,
    metadata: {
      ...current.metadata,
      ...pageContext.metadata,
      title: pageContext.metadata.title ?? pageContext.pageTitle,
    },
    updatedAt: now,
  };
}

function reorderItems(items: SelectionItem[], orderedIds: string[]): SelectionItem[] {
  if (orderedIds.length !== items.length) {
    return items;
  }

  const itemMap = new Map(items.map((item) => [item.id, item]));
  const reordered = orderedIds
    .map((itemId) => itemMap.get(itemId))
    .filter((item): item is SelectionItem => item != null);

  return reordered.length === items.length ? reordered : items;
}

function appendUniqueItems(
  currentItems: SelectionItem[],
  nextItems: SelectionItem[],
): SelectionItem[] {
  const existing = new Set(
    currentItems.map((item) => `${item.format}:${normalizeText(item.text)}:${item.imageUrl ?? ''}`),
  );

  const deduped = nextItems.filter((item) => {
    const signature = `${item.format}:${normalizeText(item.text)}:${item.imageUrl ?? ''}`;
    if (existing.has(signature)) {
      return false;
    }

    existing.add(signature);
    return true;
  });

  return [...currentItems, ...deduped];
}

export function reduceDraft(
  current: DraftDocument | null,
  action: DraftAction,
  fallbackPageContext?: PageContextPayload,
): DraftDocument | null {
  if (action.type === 'clearDraft') {
    return null;
  }

  const pageContext =
    fallbackPageContext ??
    (current == null
      ? undefined
      : {
          url: current.url,
          origin: current.origin,
          pageTitle: current.pageTitle,
          siteName: current.siteName,
          metadata: current.metadata,
        });

  if (pageContext == null) {
    throw new Error('No hay contexto de pagina para inicializar el draft.');
  }

  const draft =
    current ??
    createEmptyDraft(pageContext, action.type === 'upsertNote' ? action.tabId : 0, action.now);

  switch (action.type) {
    case 'mergePageContext':
      return updateMetadata(
        current ?? createEmptyDraft(action.payload, draft.tabId, action.now),
        action.payload,
        action.now,
      );
    case 'addSelection':
      return {
        ...updateMetadata(draft, pageContext, action.now),
        items: [...draft.items, action.payload],
      };
    case 'addSelections':
      return {
        ...updateMetadata(draft, pageContext, action.now),
        items: appendUniqueItems(draft.items, action.payload),
      };
    case 'removeSelection':
      return {
        ...draft,
        items: draft.items.filter((item) => item.id !== action.itemId),
        updatedAt: action.now,
      };
    case 'updateSelectionLabel':
      return {
        ...draft,
        items: draft.items.map((item) =>
          item.id === action.itemId
            ? {
                ...item,
                label: normalizeOptionalText(action.label),
              }
            : item,
        ),
        updatedAt: action.now,
      };
    case 'reorderSelections':
      return {
        ...draft,
        items: reorderItems(draft.items, action.orderedIds),
        updatedAt: action.now,
      };
    case 'toggleIncludeContext':
      return {
        ...draft,
        includeContext: !(draft.includeContext ?? false),
        updatedAt: action.now,
      };
    case 'upsertNote': {
      const normalizedText = normalizeText(action.text);
      const normalizedLabel = normalizeOptionalText(action.label);
      const existingIndex =
        action.noteId == null ? -1 : draft.items.findIndex((item) => item.id === action.noteId);
      const nextItem: SelectionItem = {
        id: action.noteId ?? createId('note'),
        tabId: action.tabId,
        url: action.url,
        kind: 'note',
        format: 'note',
        label: normalizedLabel,
        text: normalizedText,
        createdAt:
          existingIndex >= 0 ? (draft.items[existingIndex]?.createdAt ?? action.now) : action.now,
      };

      if (existingIndex >= 0) {
        const items = draft.items.slice();
        items[existingIndex] = nextItem;
        return {
          ...draft,
          items,
          updatedAt: action.now,
        };
      }

      return {
        ...draft,
        items: [...draft.items, nextItem],
        updatedAt: action.now,
      };
    }
    default:
      return draft;
  }
}
