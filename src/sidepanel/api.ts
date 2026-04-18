import { sendExtensionMessage } from '@/shared/runtime';
import { getDraftStorageKey } from '@/shared/storage';
import type { DraftDocument } from '@/shared/types';

export interface LoadDraftResult {
  draft: DraftDocument | null;
  active: boolean;
}

export async function resolveSidepanelTabId(search: string): Promise<number | null> {
  const params = new URLSearchParams(search);
  const fromQuery = params.get('tabId');
  if (fromQuery != null) {
    const parsed = Number(fromQuery);
    return Number.isInteger(parsed) ? parsed : null;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return activeTab?.id ?? null;
}

export async function loadDraft(tabId: number): Promise<LoadDraftResult> {
  const response = await sendExtensionMessage<LoadDraftResult>({ type: 'LOAD_DRAFT', tabId });
  if (!response.ok || response.data == null) {
    throw new Error(response.error ?? 'No fue posible cargar el draft.');
  }

  return response.data;
}

export function toOriginPermissionPattern(url: string): string | null {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return null;
  }

  return `${parsedUrl.origin}/*`;
}

export async function ensureOriginPermission(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  const tabUrl = tab.url;
  if (tabUrl == null || tabUrl.length === 0) {
    throw new Error('No fue posible resolver la URL de la pestana activa.');
  }

  const originPattern = toOriginPermissionPattern(tabUrl);
  if (originPattern == null) {
    throw new Error('El picker solo funciona sobre paginas http o https.');
  }

  const permissionRequest: chrome.permissions.Permissions = {
    origins: [originPattern],
  };
  const alreadyGranted = await chrome.permissions.contains(permissionRequest);
  if (alreadyGranted) {
    return;
  }

  const granted = await chrome.permissions.request(permissionRequest);
  if (!granted) {
    throw new Error(`No se concedio acceso a ${new URL(tabUrl).hostname}.`);
  }
}

export function subscribeToDraftChanges(
  tabId: number,
  onChange: (draft: DraftDocument | null) => void,
): () => void {
  const key = getDraftStorageKey(tabId);
  const listener: typeof chrome.storage.onChanged.addListener extends (callback: infer T) => void
    ? T
    : never = (changes, namespace) => {
    if (namespace !== 'session' || !(key in changes)) {
      return;
    }

    onChange((changes[key]?.newValue as DraftDocument | undefined) ?? null);
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function subscribeToActiveTabChanges(onChange: () => void): () => void {
  const activatedListener: typeof chrome.tabs.onActivated.addListener extends (
    callback: infer T,
  ) => void
    ? T
    : never = () => {
    void onChange();
  };
  const updatedListener: typeof chrome.tabs.onUpdated.addListener extends (
    callback: infer T,
  ) => void
    ? T
    : never = (_tabId, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.url != null || changeInfo.title != null) {
      void onChange();
    }
  };

  chrome.tabs.onActivated.addListener(activatedListener);
  chrome.tabs.onUpdated.addListener(updatedListener);

  return () => {
    chrome.tabs.onActivated.removeListener(activatedListener);
    chrome.tabs.onUpdated.removeListener(updatedListener);
  };
}

export async function request<T>(message: Parameters<typeof sendExtensionMessage>[0]): Promise<T> {
  const response = await sendExtensionMessage<T>(message);
  if (!response.ok || response.data == null) {
    throw new Error(response.error ?? 'La operacion fallo.');
  }

  return response.data;
}

export async function getPickerState(tabId: number): Promise<boolean> {
  const response = await sendExtensionMessage<{ active: boolean }>({
    type: 'GET_PICKER_STATE',
    tabId,
  });
  if (!response.ok || response.data == null) {
    throw new Error(response.error ?? 'No fue posible leer el estado del picker.');
  }

  return response.data.active;
}
