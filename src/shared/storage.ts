import { normalizeDraftDocument } from '@/shared/draft';
import type { DraftDocument } from '@/shared/types';

const draftKeyPrefix = 'draft:';
const pickerKeyPrefix = 'picker:';

export function getDraftStorageKey(tabId: number): string {
  return `${draftKeyPrefix}${tabId}`;
}

export function getPickerStorageKey(tabId: number): string {
  return `${pickerKeyPrefix}${tabId}`;
}

export async function readDraft(tabId: number): Promise<DraftDocument | null> {
  const key = getDraftStorageKey(tabId);
  const result = await chrome.storage.session.get(key);
  return normalizeDraftDocument((result[key] as DraftDocument | undefined) ?? null);
}

export async function writeDraft(tabId: number, draft: DraftDocument): Promise<void> {
  await chrome.storage.session.set({
    [getDraftStorageKey(tabId)]: normalizeDraftDocument(draft),
  });
}

export async function clearDraft(tabId: number): Promise<void> {
  await chrome.storage.session.remove(getDraftStorageKey(tabId));
}

export async function readPickerState(tabId: number): Promise<boolean> {
  const key = getPickerStorageKey(tabId);
  const result = await chrome.storage.session.get(key);
  return result[key] === true;
}

export async function writePickerState(tabId: number, active: boolean): Promise<void> {
  await chrome.storage.session.set({
    [getPickerStorageKey(tabId)]: active,
  });
}
