import { runPickerAction } from '@/content/injectPicker';
import {
  blockKeyFromItem,
  createEmptyDraft,
  deriveSelectionKey,
  getOrderedItems,
  reduceDraft,
} from '@/shared/draft';
import { siteExtractionProfiles } from '@/shared/extractionProfiles';
import { createId } from '@/shared/id';
import { generateMarkdown } from '@/shared/markdown';
import { normalizeText } from '@/shared/selectionUtils';
import {
  clearDraft,
  readDraft,
  readPickerState,
  writeDraft,
  writePickerState,
} from '@/shared/storage';
import type {
  DraftDocument,
  ExtensionMessage,
  ExtensionResponse,
  PageContextPayload,
  SelectionCapturePayload,
  SelectionFormat,
  SelectionItem,
} from '@/shared/types';

function nowIso(): string {
  return new Date().toISOString();
}

function captureAccessError(message: string, actionLabel: string): Error {
  if (message.includes('Cannot access contents of url')) {
    return new Error(
      `MD Extractor no tiene permiso para este sitio. ${actionLabel} de nuevo y concede acceso al dominio.`,
    );
  }

  return new Error(message);
}

async function setupSidepanel(): Promise<void> {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

chrome.runtime.onInstalled.addListener(() => {
  void setupSidepanel();
});

chrome.runtime.onStartup.addListener(() => {
  void setupSidepanel();
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel-lifecycle') {
    return;
  }

  let trackedTabId: number | null = null;
  let trackedPickerActive = false;

  port.onMessage.addListener((message: unknown) => {
    if (typeof message !== 'object' || message == null) {
      return;
    }

    const hasTabId = 'tabId' in message;
    const maybeActive =
      'pickerActive' in message && typeof message.pickerActive === 'boolean'
        ? message.pickerActive
        : undefined;

    if (hasTabId) {
      trackedTabId = typeof message.tabId === 'number' ? message.tabId : null;
    }
    if (maybeActive != null) {
      trackedPickerActive = maybeActive;
    }
  });

  port.onDisconnect.addListener(() => {
    if (trackedTabId == null || !trackedPickerActive) {
      return;
    }

    void handleStopPicker(trackedTabId);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    void writePickerState(tabId, false);
  }
});

async function ensureDraft(pageContext: PageContextPayload, tabId: number): Promise<DraftDocument> {
  const existing = await readDraft(tabId);
  const nextDraft = reduceDraft(
    existing,
    {
      type: 'mergePageContext',
      payload: pageContext,
      now: nowIso(),
    },
    pageContext,
  );

  if (nextDraft == null) {
    throw new Error('No fue posible inicializar el draft.');
  }

  const withTabId = {
    ...nextDraft,
    tabId,
  } satisfies DraftDocument;
  await writeDraft(tabId, withTabId);
  return withTabId;
}

async function activatePickerRuntime(tabId: number, draft: DraftDocument | null): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: runPickerAction,
      args: ['activate', highlightPayloadFromDraft(draft)],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No fue posible activar la extracción en la pagina.';
    throw captureAccessError(message, 'Activa la extracción');
  }
}

async function handleStartPicker(
  tabId: number,
): Promise<ExtensionResponse<{ active: boolean; draft: DraftDocument | null }>> {
  const [existingDraft, tab] = await Promise.all([readDraft(tabId), chrome.tabs.get(tabId)]);
  const currentUrl = tab.url;

  let nextDraft = existingDraft;
  const shouldAutoCapture =
    currentUrl != null &&
    (existingDraft == null ||
      existingDraft.url !== currentUrl ||
      getOrderedItems(existingDraft).length === 0);

  if (shouldAutoCapture) {
    nextDraft = await captureDocumentToDraft(tabId, {
      existingDraft,
      overwrite: true,
    });
  }

  await activatePickerRuntime(tabId, nextDraft);
  await writePickerState(tabId, true);
  return { ok: true, data: { active: true, draft: nextDraft } };
}

async function handleStopPicker(tabId: number): Promise<ExtensionResponse<{ active: boolean }>> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: runPickerAction,
      args: ['deactivate', []],
    });
  } catch {
    // If the picker was never injected we still normalize the stored state.
  }

  await writePickerState(tabId, false);
  return { ok: true, data: { active: false } };
}

function toSelectionItem(
  tabId: number,
  pageContext: PageContextPayload,
  selection: SelectionCapturePayload,
): SelectionItem {
  return {
    id: createId('sel'),
    tabId,
    url: pageContext.url,
    kind: selection.kind,
    format: selection.format,
    selectionKey: selectionKeyFromCapture(selection),
    label: selection.label,
    text: normalizeText(selection.text),
    orderKey: selection.orderKey,
    htmlSnippet: selection.htmlSnippet,
    imageUrl: selection.imageUrl,
    selectorHint: selection.selectorHint,
    headingLevel: selection.headingLevel,
    listItems: selection.listItems,
    orderedList: selection.orderedList,
    table: selection.table,
    createdAt: nowIso(),
  };
}

function derivedSelectionKey(
  format: SelectionFormat,
  selectorHint: string | undefined,
): string | undefined {
  return deriveSelectionKey(format, selectorHint);
}

function selectionKeyFromCapture(selection: SelectionCapturePayload): string | undefined {
  return selection.selectionKey ?? derivedSelectionKey(selection.format, selection.selectorHint);
}

function selectionKeyFromItem(item: SelectionItem): string | undefined {
  if (item.kind === 'note' || item.kind === 'textRange') {
    return undefined;
  }

  return blockKeyFromItem(item);
}

function highlightPayloadFromDraft(
  draft: DraftDocument | null,
): Array<{ selectionKey: string; selectorHint: string }> {
  if (draft == null) {
    return [];
  }

  return getOrderedItems(draft).flatMap((item) => {
    const selectionKey = selectionKeyFromItem(item);
    if (selectionKey == null || item.selectorHint == null) {
      return [];
    }

    return [{ selectionKey, selectorHint: item.selectorHint }];
  });
}

async function syncPickerHighlights(tabId: number, draft: DraftDocument | null): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: runPickerAction,
      args: ['syncHighlights', highlightPayloadFromDraft(draft)],
    });
  } catch {
    // The picker runtime may not be injected on this tab yet.
  }
}

async function captureDocument(tabId: number): Promise<{
  pageContext: PageContextPayload;
  selections: SelectionCapturePayload[];
}> {
  let scriptResults: chrome.scripting.InjectionResult<ReturnType<typeof runPickerAction>>[];

  try {
    scriptResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: runPickerAction,
      args: ['captureDocument', [], siteExtractionProfiles],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No fue posible capturar el contenido de la pagina.';
    throw captureAccessError(message, 'Activa la extracción');
  }

  const capture = scriptResults[0]?.result;
  if (capture == null) {
    throw new Error('No fue posible leer el contenido de la pagina.');
  }

  return capture;
}

async function buildCapturedDraft(
  tabId: number,
  capture: { pageContext: PageContextPayload; selections: SelectionCapturePayload[] },
  existingDraft: DraftDocument | null,
): Promise<DraftDocument> {
  const now = nowIso();
  const baseDraft = createEmptyDraft(capture.pageContext, tabId, now);
  baseDraft.includeContext = existingDraft?.includeContext ?? false;
  const nextItems = capture.selections.map((selection: SelectionCapturePayload) =>
    toSelectionItem(tabId, capture.pageContext, selection),
  );
  const nextDraft = reduceDraft(
    baseDraft,
    {
      type: 'addSelections',
      payload: nextItems,
      now,
    },
    capture.pageContext,
  );

  if (nextDraft == null) {
    throw new Error('No fue posible guardar la extracción automatica.');
  }

  return {
    ...nextDraft,
    tabId,
  };
}

async function captureDocumentToDraft(
  tabId: number,
  options: { existingDraft?: DraftDocument | null; overwrite: boolean },
): Promise<DraftDocument> {
  const capture = await captureDocument(tabId);
  const existingDraft = options.existingDraft ?? (await readDraft(tabId));

  if (!options.overwrite) {
    const baseDraft = await ensureDraft(capture.pageContext, tabId);
    const nextItems = capture.selections.map((selection) =>
      toSelectionItem(tabId, capture.pageContext, selection),
    );
    const nextDraft = reduceDraft(
      baseDraft,
      {
        type: 'addSelections',
        payload: nextItems,
        now: nowIso(),
      },
      capture.pageContext,
    );

    if (nextDraft == null) {
      throw new Error('No fue posible guardar la extracción automatica.');
    }

    await writeDraft(tabId, nextDraft);
    return nextDraft;
  }

  const nextDraft = await buildCapturedDraft(tabId, capture, existingDraft);
  await writeDraft(tabId, nextDraft);
  return nextDraft;
}

async function handleRestartExtraction(
  tabId: number,
): Promise<ExtensionResponse<{ active: boolean; draft: DraftDocument }>> {
  const existingDraft = await readDraft(tabId);
  const nextDraft = await captureDocumentToDraft(tabId, {
    existingDraft,
    overwrite: true,
  });
  await activatePickerRuntime(tabId, nextDraft);
  await writePickerState(tabId, true);
  return response({ active: true, draft: nextDraft });
}

async function handleCapturePrimaryContent(
  tabId: number,
): Promise<ExtensionResponse<{ draft: DraftDocument; captured: number }>> {
  const existingDraft = await readDraft(tabId);
  const nextDraft = await captureDocumentToDraft(tabId, {
    existingDraft,
    overwrite: true,
  });
  await syncPickerHighlights(tabId, nextDraft);
  return response({
    draft: nextDraft,
    captured: getOrderedItems(nextDraft).length,
  });
}

function response<T>(data: T): ExtensionResponse<T> {
  return { ok: true, data };
}

function errorResponse(error: unknown): ExtensionResponse {
  return {
    ok: false,
    error: error instanceof Error ? error.message : 'Error inesperado en background.',
  };
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  void (async () => {
    try {
      switch (message.type) {
        case 'START_PICKER':
          sendResponse(await handleStartPicker(message.tabId));
          return;
        case 'STOP_PICKER':
          sendResponse(await handleStopPicker(message.tabId));
          return;
        case 'RESTART_EXTRACTION':
          sendResponse(await handleRestartExtraction(message.tabId));
          return;
        case 'CAPTURE_PRIMARY_CONTENT':
          sendResponse(await handleCapturePrimaryContent(message.tabId));
          return;
        case 'LOAD_DRAFT': {
          const [draft, active] = await Promise.all([
            readDraft(message.tabId),
            readPickerState(message.tabId),
          ]);
          sendResponse(response({ draft, active }));
          return;
        }
        case 'GET_PICKER_STATE':
          sendResponse(response({ active: await readPickerState(message.tabId) }));
          return;
        case 'CLEAR_DRAFT': {
          await clearDraft(message.tabId);
          await syncPickerHighlights(message.tabId, null);
          sendResponse(response({ draft: null }));
          return;
        }
        case 'REMOVE_SELECTION': {
          const draft = await readDraft(message.tabId);
          const nextDraft = reduceDraft(draft, {
            type: 'removeSelection',
            itemId: message.itemId,
            now: nowIso(),
          });

          if (nextDraft == null) {
            await clearDraft(message.tabId);
          } else {
            await writeDraft(message.tabId, nextDraft);
          }

          await syncPickerHighlights(message.tabId, nextDraft);

          sendResponse(response({ draft: nextDraft }));
          return;
        }
        case 'UPDATE_SELECTION_LABEL': {
          const draft = await readDraft(message.tabId);
          const nextDraft = reduceDraft(draft, {
            type: 'updateSelectionLabel',
            itemId: message.itemId,
            label: message.label,
            now: nowIso(),
          });

          if (nextDraft == null) {
            throw new Error('No existe un draft activo para renombrar.');
          }

          await writeDraft(message.tabId, nextDraft);
          sendResponse(response({ draft: nextDraft }));
          return;
        }
        case 'REORDER_SELECTIONS': {
          const draft = await readDraft(message.tabId);
          const nextDraft = reduceDraft(draft, {
            type: 'reorderSelections',
            orderedIds: message.orderedIds,
            now: nowIso(),
          });

          if (nextDraft == null) {
            throw new Error('No existe un draft activo para reordenar.');
          }

          await writeDraft(message.tabId, nextDraft);
          sendResponse(response({ draft: nextDraft }));
          return;
        }
        case 'UPSERT_NOTE': {
          const draft = await readDraft(message.tabId);
          const pageContext =
            draft == null
              ? {
                  url: message.url,
                  origin: new URL(message.url).origin,
                  pageTitle: 'Notas manuales',
                  siteName: new URL(message.url).hostname,
                  metadata: {
                    title: 'Notas manuales',
                  },
                }
              : {
                  url: draft.url,
                  origin: draft.origin,
                  pageTitle: draft.pageTitle,
                  siteName: draft.siteName,
                  metadata: draft.metadata,
                };

          const nextDraft = reduceDraft(
            draft,
            {
              type: 'upsertNote',
              noteId: message.noteId,
              label: message.label,
              text: message.text,
              now: nowIso(),
              tabId: message.tabId,
              url: pageContext.url,
            },
            pageContext,
          );

          if (nextDraft == null) {
            throw new Error('No fue posible guardar la nota.');
          }

          await writeDraft(message.tabId, nextDraft);
          sendResponse(response({ draft: nextDraft }));
          return;
        }
        case 'COPY_MARKDOWN': {
          const draft = await readDraft(message.tabId);
          sendResponse(response({ markdown: generateMarkdown(draft) }));
          return;
        }
        case 'TOGGLE_CONTEXT': {
          const draft = await readDraft(message.tabId);
          if (draft == null) {
            throw new Error('No existe un draft activo para agregar contexto.');
          }

          const nextDraft = reduceDraft(draft, {
            type: 'toggleIncludeContext',
            now: nowIso(),
          });

          if (nextDraft == null) {
            throw new Error('No fue posible actualizar el contexto del draft.');
          }

          await writeDraft(message.tabId, nextDraft);
          sendResponse(response({ draft: nextDraft }));
          return;
        }
        case 'SYNC_PAGE_CONTEXT': {
          const nextDraft = await ensureDraft(message.pageContext, sender.tab?.id ?? 0);
          sendResponse(response({ draft: nextDraft }));
          return;
        }
        case 'TOGGLE_SELECTION_FROM_PAGE': {
          const tabId = sender.tab?.id;

          if (tabId == null) {
            throw new Error('La seleccion no viene asociada a una pestana.');
          }

          const baseDraft = await ensureDraft(message.pageContext, tabId);
          const orderedItems = getOrderedItems(baseDraft);
          const selectionKey = selectionKeyFromCapture(message.selection);
          const existingItem =
            selectionKey == null
              ? undefined
              : orderedItems.find((item) => selectionKeyFromItem(item) === selectionKey);

          const nextDraft =
            existingItem == null
              ? reduceDraft(
                  baseDraft,
                  {
                    type: 'addSelection',
                    payload: toSelectionItem(tabId, message.pageContext, message.selection),
                    now: nowIso(),
                  },
                  message.pageContext,
                )
              : reduceDraft(baseDraft, {
                  type: 'removeSelection',
                  itemId: existingItem.id,
                  now: nowIso(),
                });

          if (nextDraft == null) {
            await clearDraft(tabId);
            await syncPickerHighlights(tabId, null);
            sendResponse(response({ draft: null, removed: existingItem != null }));
            return;
          }

          await writeDraft(tabId, nextDraft);
          await syncPickerHighlights(tabId, nextDraft);
          sendResponse(response({ draft: nextDraft, removed: existingItem != null }));
          return;
        }
        case 'ADD_SELECTION_FROM_PAGE': {
          const tabId = sender.tab?.id;

          if (tabId == null) {
            throw new Error('La seleccion no viene asociada a una pestana.');
          }

          const baseDraft = await ensureDraft(message.pageContext, tabId);
          const selection: SelectionItem = {
            id: createId('sel'),
            tabId,
            url: message.pageContext.url,
            kind: message.selection.kind,
            format: message.selection.format,
            orderKey: message.selection.orderKey,
            selectionKey: selectionKeyFromCapture(message.selection),
            label: message.selection.label,
            text: normalizeText(message.selection.text),
            htmlSnippet: message.selection.htmlSnippet,
            imageUrl: message.selection.imageUrl,
            selectorHint: message.selection.selectorHint,
            headingLevel: message.selection.headingLevel,
            listItems: message.selection.listItems,
            orderedList: message.selection.orderedList,
            table: message.selection.table,
            createdAt: nowIso(),
          };
          const nextDraft = reduceDraft(
            baseDraft,
            {
              type: 'addSelection',
              payload: selection,
              now: nowIso(),
            },
            message.pageContext,
          );

          if (nextDraft == null) {
            throw new Error('No fue posible guardar la seleccion.');
          }

          await writeDraft(tabId, nextDraft);
          await syncPickerHighlights(tabId, nextDraft);
          sendResponse(response({ draft: nextDraft }));
          return;
        }
      }
    } catch (error) {
      sendResponse(errorResponse(error));
    }
  })();

  return true;
});
