import { createId } from '@/shared/id';
import { normalizeOptionalText, normalizeText } from '@/shared/selectionUtils';
import type {
  DraftAction,
  DraftDocument,
  PageContextPayload,
  SelectionBlock,
  SelectionFormat,
  SelectionItem,
} from '@/shared/types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}

export function deriveSelectionKey(
  format: SelectionFormat,
  selectorHint: string | undefined,
): string | undefined {
  return selectorHint == null ? undefined : `${format}:${selectorHint}`;
}

export function blockKeyFromItem(item: SelectionItem): string {
  if (item.kind === 'note') {
    return item.id;
  }

  return item.selectionKey ?? deriveSelectionKey(item.format, item.selectorHint) ?? item.id;
}

function compareOrderKeys(left: SelectionItem, right: SelectionItem): number {
  if (left.orderKey == null && right.orderKey == null) {
    return 0;
  }
  if (left.orderKey == null) {
    return 1;
  }
  if (right.orderKey == null) {
    return -1;
  }

  return left.orderKey.localeCompare(right.orderKey);
}

function buildItemsSnapshot(
  blocksByKey: Record<string, SelectionBlock>,
  orderedKeys: string[],
): SelectionItem[] {
  return orderedKeys
    .map((key) => blocksByKey[key])
    .filter((item): item is SelectionItem => item != null);
}

function materializeDraft(draft: DraftDocument): DraftDocument {
  const nextOrderedKeys = draft.orderedKeys.filter((key) => draft.blocksByKey[key] != null);
  return {
    ...draft,
    orderedKeys: nextOrderedKeys,
    items: buildItemsSnapshot(draft.blocksByKey, nextOrderedKeys),
  };
}

function sortKeysByOrder(
  orderedKeys: string[],
  blocksByKey: Record<string, SelectionBlock>,
): string[] {
  return orderedKeys.slice().sort((leftKey, rightKey) => {
    const left = blocksByKey[leftKey];
    const right = blocksByKey[rightKey];
    if (left == null && right == null) {
      return 0;
    }
    if (left == null) {
      return 1;
    }
    if (right == null) {
      return -1;
    }

    return compareOrderKeys(left, right);
  });
}

function mergeOrderedKeysPreservingBatch(
  currentOrderedKeys: string[],
  nextKeys: string[],
): string[] {
  const seen = new Set(currentOrderedKeys);
  const orderedKeys = currentOrderedKeys.slice();

  nextKeys.forEach((key) => {
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    orderedKeys.push(key);
  });

  return orderedKeys;
}

function draftFromLegacyItems(
  input: Omit<DraftDocument, 'blocksByKey' | 'orderedKeys' | 'items'> & {
    blocksByKey?: Record<string, SelectionBlock>;
    orderedKeys?: string[];
    items?: SelectionItem[];
  },
): DraftDocument {
  const legacyItems = input.items ?? [];
  const blocksByKey = legacyItems.reduce<Record<string, SelectionBlock>>((accumulator, item) => {
    accumulator[blockKeyFromItem(item)] = item;
    return accumulator;
  }, {});
  const orderedKeys = legacyItems.map(blockKeyFromItem);

  return materializeDraft({
    ...input,
    blocksByKey,
    orderedKeys,
    items: legacyItems,
  });
}

export function normalizeDraftDocument(draft: DraftDocument | null): DraftDocument | null {
  if (draft == null) {
    return null;
  }

  if (
    !isObject(draft) ||
    !isObject(draft.metadata) ||
    !Array.isArray(draft.items) ||
    typeof draft.url !== 'string'
  ) {
    throw new Error('El draft persistido tiene una forma invalida.');
  }

  const maybeBlocksByKey = 'blocksByKey' in draft ? draft.blocksByKey : undefined;
  const maybeOrderedKeys = 'orderedKeys' in draft ? draft.orderedKeys : undefined;
  if (!isObject(maybeBlocksByKey) || !Array.isArray(maybeOrderedKeys)) {
    return draftFromLegacyItems(draft);
  }

  return materializeDraft(draft);
}

export function getOrderedItems(draft: DraftDocument | null): SelectionItem[] {
  if (draft == null) {
    return [];
  }

  return buildItemsSnapshot(draft.blocksByKey, draft.orderedKeys);
}

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
    blocksByKey: {},
    orderedKeys: [],
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

function reorderItems(draft: DraftDocument, orderedIds: string[]): DraftDocument {
  if (orderedIds.length !== draft.orderedKeys.length) {
    return draft;
  }

  const keyById = new Map(
    Object.entries(draft.blocksByKey).map(([key, item]) => [item.id, key] as const),
  );
  const reorderedKeys = orderedIds
    .map((itemId) => keyById.get(itemId))
    .filter((key): key is string => key != null);

  if (reorderedKeys.length !== draft.orderedKeys.length) {
    return draft;
  }

  return materializeDraft({
    ...draft,
    orderedKeys: reorderedKeys,
  });
}

function upsertSelectionBlock(
  draft: DraftDocument,
  item: SelectionItem,
  options: { preserveBatchOrder: boolean },
): DraftDocument {
  const key = blockKeyFromItem(item);
  const blocksByKey = {
    ...draft.blocksByKey,
    [key]: item,
  };
  const alreadyIncluded = draft.orderedKeys.includes(key);
  const orderedKeys = alreadyIncluded
    ? draft.orderedKeys.slice()
    : options.preserveBatchOrder
      ? [...draft.orderedKeys, key]
      : sortKeysByOrder([...draft.orderedKeys, key], blocksByKey);

  return materializeDraft({
    ...draft,
    blocksByKey,
    orderedKeys,
  });
}

function appendUniqueItems(draft: DraftDocument, nextItems: SelectionItem[]): DraftDocument {
  const blocksByKey = { ...draft.blocksByKey };
  const nextKeys: string[] = [];

  nextItems.forEach((item) => {
    const key = blockKeyFromItem(item);
    blocksByKey[key] = item;
    nextKeys.push(key);
  });

  return materializeDraft({
    ...draft,
    blocksByKey,
    orderedKeys: mergeOrderedKeysPreservingBatch(draft.orderedKeys, nextKeys),
  });
}

function removeSelectionById(draft: DraftDocument, itemId: string): DraftDocument {
  const matchingEntry = Object.entries(draft.blocksByKey).find(
    ([key, item]) => key === itemId || item.id === itemId,
  );
  if (matchingEntry == null) {
    return draft;
  }

  const [blockKey] = matchingEntry;
  const { [blockKey]: _removed, ...remainingBlocks } = draft.blocksByKey;

  return materializeDraft({
    ...draft,
    blocksByKey: remainingBlocks,
    orderedKeys: draft.orderedKeys.filter((key) => key !== blockKey),
  });
}

export function reduceDraft(
  current: DraftDocument | null,
  action: DraftAction,
  fallbackPageContext?: PageContextPayload,
): DraftDocument | null {
  if (action.type === 'clearDraft') {
    return null;
  }

  const normalizedCurrent = normalizeDraftDocument(current);
  const pageContext =
    fallbackPageContext ??
    (normalizedCurrent == null
      ? undefined
      : {
          url: normalizedCurrent.url,
          origin: normalizedCurrent.origin,
          pageTitle: normalizedCurrent.pageTitle,
          siteName: normalizedCurrent.siteName,
          metadata: normalizedCurrent.metadata,
        });

  if (pageContext == null) {
    throw new Error('No hay contexto de pagina para inicializar el draft.');
  }

  const draft =
    normalizedCurrent ??
    createEmptyDraft(pageContext, action.type === 'upsertNote' ? action.tabId : 0, action.now);

  switch (action.type) {
    case 'mergePageContext':
      return updateMetadata(
        normalizedCurrent ?? createEmptyDraft(action.payload, draft.tabId, action.now),
        action.payload,
        action.now,
      );
    case 'addSelection':
      return {
        ...upsertSelectionBlock(updateMetadata(draft, pageContext, action.now), action.payload, {
          preserveBatchOrder: false,
        }),
        updatedAt: action.now,
      };
    case 'addSelections':
      return {
        ...appendUniqueItems(updateMetadata(draft, pageContext, action.now), action.payload),
        updatedAt: action.now,
      };
    case 'removeSelection':
      return {
        ...removeSelectionById(draft, action.itemId),
        updatedAt: action.now,
      };
    case 'updateSelectionLabel': {
      const matchingEntry = Object.entries(draft.blocksByKey).find(
        ([key, item]) => key === action.itemId || item.id === action.itemId,
      );

      if (matchingEntry == null) {
        return {
          ...draft,
          updatedAt: action.now,
        };
      }

      const [blockKey, item] = matchingEntry;
      return materializeDraft({
        ...draft,
        blocksByKey: {
          ...draft.blocksByKey,
          [blockKey]: {
            ...item,
            label: normalizeOptionalText(action.label),
          },
        },
        updatedAt: action.now,
      });
    }
    case 'reorderSelections':
      return {
        ...reorderItems(draft, action.orderedIds),
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
      const noteKey = action.noteId ?? createId('note');
      const existingItem = draft.blocksByKey[noteKey];
      const nextItem: SelectionItem = {
        id: noteKey,
        tabId: action.tabId,
        url: action.url,
        kind: 'note',
        format: 'note',
        label: normalizedLabel,
        text: normalizedText,
        createdAt: existingItem?.createdAt ?? action.now,
      };

      return materializeDraft({
        ...draft,
        blocksByKey: {
          ...draft.blocksByKey,
          [noteKey]: nextItem,
        },
        orderedKeys: draft.orderedKeys.includes(noteKey)
          ? draft.orderedKeys
          : [...draft.orderedKeys, noteKey],
        updatedAt: action.now,
      });
    }
    default:
      return draft;
  }
}
