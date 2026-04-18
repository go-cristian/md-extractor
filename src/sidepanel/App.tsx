import { useEffect, useMemo, useRef, useState } from 'react';
import { generateMarkdown } from '@/shared/markdown';
import type { DraftDocument } from '@/shared/types';
import {
  ensureOriginPermission,
  loadDraft,
  request,
  resolveSidepanelTabId,
  subscribeToActiveTabChanges,
  subscribeToDraftChanges,
} from '@/sidepanel/api';
import { SidepanelView } from '@/sidepanel/SidepanelView';

export function App() {
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftDocument | null>(null);
  const [pickerActive, setPickerActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [noteLabelInput, setNoteLabelInput] = useState('');
  const dragItemId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribeDraft: (() => void) | undefined;

    async function refresh(): Promise<void> {
      const tabId = await resolveSidepanelTabId(window.location.search);
      if (!mounted) {
        return;
      }

      setCurrentTabId(tabId);
      if (unsubscribeDraft != null) {
        unsubscribeDraft();
      }

      if (tabId == null) {
        setDraft(null);
        setPickerActive(false);
        return;
      }

      const result = await loadDraft(tabId);
      if (!mounted) {
        return;
      }

      setDraft(result.draft);
      setPickerActive(result.active);
      unsubscribeDraft = subscribeToDraftChanges(tabId, (nextDraft) => {
        setDraft(nextDraft);
      });
    }

    void refresh();
    const unsubscribeTabs = subscribeToActiveTabChanges(() => {
      void refresh();
    });

    return () => {
      mounted = false;
      unsubscribeDraft?.();
      unsubscribeTabs();
    };
  }, []);

  const markdown = useMemo(() => generateMarkdown(draft), [draft]);
  const includeContextEnabled = draft?.includeContext === true;

  async function requireTabId(): Promise<number> {
    if (currentTabId == null) {
      throw new Error('No hay una pestana activa disponible.');
    }

    return currentTabId;
  }

  async function perform(action: () => Promise<void>, successMessage?: string): Promise<void> {
    try {
      await action();
      setStatusMessage(successMessage ?? null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'La accion fallo.');
    }
  }

  return (
    <SidepanelView
      currentTabId={currentTabId}
      draft={draft}
      includeContextEnabled={includeContextEnabled}
      markdown={markdown}
      noteInput={noteInput}
      noteLabelInput={noteLabelInput}
      onClearDraft={() => {
        void perform(async () => {
          const tabId = await requireTabId();
          await request<{ draft: DraftDocument | null }>({ type: 'CLEAR_DRAFT', tabId });
          setDraft(null);
        }, 'Draft limpio.');
      }}
      onCopyMarkdown={() => {
        void perform(async () => {
          const tabId = await requireTabId();
          const result = await request<{ markdown: string }>({ type: 'COPY_MARKDOWN', tabId });
          await navigator.clipboard.writeText(result.markdown);
        }, 'Markdown copiado al portapapeles.');
      }}
      onToggleContext={() => {
        void perform(
          async () => {
            const tabId = await requireTabId();
            const result = await request<{ draft: DraftDocument }>({
              type: 'TOGGLE_CONTEXT',
              tabId,
            });
            setDraft(result.draft);
          },
          includeContextEnabled
            ? 'Contexto removido del Markdown.'
            : 'Contexto agregado al Markdown.',
        );
      }}
      onDeleteItem={(itemId) => {
        void perform(async () => {
          const tabId = await requireTabId();
          const result = await request<{ draft: DraftDocument | null }>({
            type: 'REMOVE_SELECTION',
            tabId,
            itemId,
          });
          setDraft(result.draft);
        });
      }}
      onDragStart={(itemId) => {
        dragItemId.current = itemId;
      }}
      onDrop={(targetId) => {
        void perform(async () => {
          const tabId = await requireTabId();
          const sourceId = dragItemId.current;
          if (sourceId == null || draft == null || sourceId === targetId) {
            return;
          }

          const orderedIds = draft.items.map((item) => item.id);
          const sourceIndex = orderedIds.indexOf(sourceId);
          const targetIndex = orderedIds.indexOf(targetId);
          if (sourceIndex === -1 || targetIndex === -1) {
            return;
          }

          orderedIds.splice(sourceIndex, 1);
          orderedIds.splice(targetIndex, 0, sourceId);

          const result = await request<{ draft: DraftDocument }>({
            type: 'REORDER_SELECTIONS',
            tabId,
            orderedIds,
          });
          setDraft(result.draft);
          dragItemId.current = null;
        });
      }}
      onLabelChange={(itemId, value) => {
        void perform(async () => {
          const tabId = await requireTabId();
          const result = await request<{ draft: DraftDocument }>({
            type: 'UPDATE_SELECTION_LABEL',
            tabId,
            itemId,
            label: value,
          });
          setDraft(result.draft);
        });
      }}
      onNoteInputChange={setNoteInput}
      onNoteLabelInputChange={setNoteLabelInput}
      onSaveNote={() => {
        void perform(async () => {
          const tabId = await requireTabId();
          if (noteInput.trim().length === 0) {
            throw new Error('La nota no puede estar vacia.');
          }

          const result = await request<{ draft: DraftDocument }>({
            type: 'UPSERT_NOTE',
            tabId,
            text: noteInput,
            label: noteLabelInput || undefined,
            url: draft?.url ?? 'https://captura.local/notas',
          });
          setDraft(result.draft);
          setNoteInput('');
          setNoteLabelInput('');
        }, 'Nota guardada.');
      }}
      onTogglePicker={() => {
        void perform(
          async () => {
            const tabId = await requireTabId();
            if (pickerActive) {
              await request<{ active: boolean }>({ type: 'STOP_PICKER', tabId });
              setPickerActive(false);
              return;
            }

            await ensureOriginPermission(tabId);
            await request<{ active: boolean }>({ type: 'START_PICKER', tabId });
            setPickerActive(true);
          },
          pickerActive
            ? 'Picker pausado.'
            : 'Picker activo. Vuelve a la pagina y haz click o drag.',
        );
      }}
      pickerActive={pickerActive}
      statusMessage={statusMessage}
    />
  );
}
