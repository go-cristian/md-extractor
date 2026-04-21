import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildMarkdownPreviewBlocks, generateMarkdown } from '@/shared/markdown';
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
  const currentTabIdRef = useRef<number | null>(null);
  const pickerActiveRef = useRef(false);
  const lifecyclePortRef = useRef<chrome.runtime.Port | null>(null);

  const publishLifecycleState = useCallback(
    (
      nextTabId: number | null = currentTabIdRef.current,
      nextPickerActive: boolean = pickerActiveRef.current,
    ): void => {
      lifecyclePortRef.current?.postMessage({
        tabId: nextTabId,
        pickerActive: nextPickerActive,
      });
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    let unsubscribeDraft: (() => void) | undefined;

    async function refresh(): Promise<void> {
      const tabId = await resolveSidepanelTabId(window.location.search);
      if (!mounted) {
        return;
      }

      setCurrentTabId(tabId);
      currentTabIdRef.current = tabId;
      unsubscribeDraft?.();

      if (tabId == null) {
        setDraft(null);
        setPickerActive(false);
        pickerActiveRef.current = false;
        publishLifecycleState(null, false);
        return;
      }

      const result = await loadDraft(tabId);
      if (!mounted) {
        return;
      }

      setDraft(result.draft);
      setPickerActive(result.active);
      pickerActiveRef.current = result.active;
      publishLifecycleState(tabId, result.active);
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
  }, [publishLifecycleState]);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'sidepanel-lifecycle' });
    lifecyclePortRef.current = port;

    return () => {
      lifecyclePortRef.current = null;
      port.disconnect();
    };
  }, []);

  useEffect(() => {
    currentTabIdRef.current = currentTabId;
    publishLifecycleState(currentTabId, pickerActiveRef.current);
  }, [currentTabId, publishLifecycleState]);

  useEffect(() => {
    pickerActiveRef.current = pickerActive;
    publishLifecycleState(currentTabIdRef.current, pickerActive);
  }, [pickerActive, publishLifecycleState]);

  useEffect(() => {
    const stopPickerOnTeardown = () => {
      const tabId = currentTabIdRef.current;
      if (tabId == null || !pickerActiveRef.current) {
        return;
      }

      void chrome.runtime.sendMessage({ type: 'STOP_PICKER', tabId });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopPickerOnTeardown();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', stopPickerOnTeardown);
    window.addEventListener('beforeunload', stopPickerOnTeardown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', stopPickerOnTeardown);
      window.removeEventListener('beforeunload', stopPickerOnTeardown);
      stopPickerOnTeardown();
    };
  }, []);

  const markdown = useMemo(() => generateMarkdown(draft), [draft]);
  const previewBlocks = useMemo(() => buildMarkdownPreviewBlocks(draft), [draft]);

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
      markdown={markdown}
      previewBlocks={previewBlocks}
      onCopyMarkdown={() => {
        void perform(async () => {
          const tabId = await requireTabId();
          const result = await request<{ markdown: string }>({ type: 'COPY_MARKDOWN', tabId });
          await navigator.clipboard.writeText(result.markdown);
        }, 'Markdown copiado al portapapeles.');
      }}
      onRemoveSelection={(itemId) => {
        void perform(async () => {
          const tabId = await requireTabId();
          const result = await request<{ draft: DraftDocument | null }>({
            type: 'REMOVE_SELECTION',
            tabId,
            itemId,
          });
          setDraft(result.draft);
        }, 'Bloque eliminado.');
      }}
      onRestartExtraction={() => {
        void perform(async () => {
          const tabId = await requireTabId();
          await ensureOriginPermission(tabId);
          const result = await request<{ active: boolean; draft: DraftDocument }>({
            type: 'RESTART_EXTRACTION',
            tabId,
          });
          setPickerActive(result.active);
          pickerActiveRef.current = result.active;
          publishLifecycleState(tabId, result.active);
          setDraft(result.draft);
        }, 'Extracción reiniciada.');
      }}
      onTogglePicker={() => {
        void perform(
          async () => {
            const tabId = await requireTabId();
            if (pickerActive) {
              await request<{ active: boolean }>({ type: 'STOP_PICKER', tabId });
              setPickerActive(false);
              pickerActiveRef.current = false;
              publishLifecycleState(tabId, false);
              return;
            }

            await ensureOriginPermission(tabId);
            const result = await request<{ active: boolean; draft: DraftDocument | null }>({
              type: 'START_PICKER',
              tabId,
            });
            setPickerActive(result.active);
            pickerActiveRef.current = result.active;
            publishLifecycleState(tabId, result.active);
            setDraft(result.draft);
          },
          pickerActive ? 'Extracción pausada.' : 'Extracción lista.',
        );
      }}
      pickerActive={pickerActive}
      statusMessage={statusMessage}
    />
  );
}
