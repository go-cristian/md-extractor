export type SelectionKind = 'element' | 'textRange' | 'image' | 'note';
export type SelectionFormat = 'heading' | 'paragraph' | 'list' | 'table' | 'image' | 'note';

export interface SelectionTable {
  headers: string[];
  rows: string[][];
}

export interface PageMetadata {
  title: string;
  price?: string | undefined;
  currency?: string | undefined;
  seller?: string | undefined;
  rating?: string | undefined;
  availability?: string | undefined;
  heroImageUrl?: string | undefined;
}

export interface SelectionItem {
  id: string;
  tabId: number;
  url: string;
  kind: SelectionKind;
  format: SelectionFormat;
  orderKey?: string | undefined;
  selectionKey?: string | undefined;
  label?: string | undefined;
  text: string;
  htmlSnippet?: string | undefined;
  imageUrl?: string | undefined;
  selectorHint?: string | undefined;
  headingLevel?: number | undefined;
  listItems?: string[] | undefined;
  orderedList?: boolean | undefined;
  table?: SelectionTable | undefined;
  createdAt: string;
}

export type SelectionBlock = SelectionItem;

export interface DraftDocument {
  tabId: number;
  url: string;
  origin: string;
  pageTitle: string;
  siteName: string;
  includeContext?: boolean | undefined;
  metadata: PageMetadata;
  blocksByKey: Record<string, SelectionBlock>;
  orderedKeys: string[];
  items: SelectionItem[];
  updatedAt: string;
}

export interface SiteAdapter {
  id: string;
  matches(url: URL, document: Document): boolean;
  extractMetadata(document: Document): Partial<PageMetadata>;
}

export interface RevealStep {
  type: 'click';
  selector?: string | undefined;
  text?: string | undefined;
  label: string;
  optional?: boolean | undefined;
  revealSelectors?: string[] | undefined;
}

export interface ExtractionBlockConfig {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'image';
  selectors: string[];
  headingLevel?: number | undefined;
}

export interface SiteExtractionProfile {
  id: string;
  hostnames?: string[] | undefined;
  signals?: string[] | undefined;
  anchorSelectors?: string[] | undefined;
  reveal?: RevealStep[] | undefined;
  blocks: ExtractionBlockConfig[];
}

export interface ExtractionProfileResult {
  profileId: string;
  revealApplied: boolean;
  selections: SelectionCapturePayload[];
}

export interface PageContextPayload {
  url: string;
  origin: string;
  pageTitle: string;
  siteName: string;
  metadata: Partial<PageMetadata>;
}

export interface SelectionCapturePayload {
  kind: Exclude<SelectionKind, 'note'>;
  format: Exclude<SelectionFormat, 'note'>;
  orderKey?: string | undefined;
  selectionKey?: string | undefined;
  text: string;
  htmlSnippet?: string | undefined;
  imageUrl?: string | undefined;
  selectorHint?: string | undefined;
  label?: string | undefined;
  headingLevel?: number | undefined;
  listItems?: string[] | undefined;
  orderedList?: boolean | undefined;
  table?: SelectionTable | undefined;
}

export interface PrimaryCapturePayload {
  pageContext: PageContextPayload;
  selections: SelectionCapturePayload[];
}

export type DraftAction =
  | {
      type: 'mergePageContext';
      payload: PageContextPayload;
      now: string;
    }
  | {
      type: 'addSelection';
      payload: SelectionItem;
      now: string;
    }
  | {
      type: 'addSelections';
      payload: SelectionItem[];
      now: string;
    }
  | {
      type: 'removeSelection';
      itemId: string;
      now: string;
    }
  | {
      type: 'updateSelectionLabel';
      itemId: string;
      label: string;
      now: string;
    }
  | {
      type: 'reorderSelections';
      orderedIds: string[];
      now: string;
    }
  | {
      type: 'upsertNote';
      noteId?: string | undefined;
      label?: string | undefined;
      text: string;
      now: string;
      tabId: number;
      url: string;
    }
  | {
      type: 'toggleIncludeContext';
      now: string;
    }
  | {
      type: 'clearDraft';
      now: string;
    };

export type ExtensionMessage =
  | { type: 'START_PICKER'; tabId: number }
  | { type: 'STOP_PICKER'; tabId: number }
  | { type: 'RESTART_EXTRACTION'; tabId: number }
  | { type: 'CAPTURE_PRIMARY_CONTENT'; tabId: number }
  | { type: 'LOAD_DRAFT'; tabId: number }
  | { type: 'CLEAR_DRAFT'; tabId: number }
  | { type: 'REMOVE_SELECTION'; tabId: number; itemId: string }
  | {
      type: 'UPDATE_SELECTION_LABEL';
      tabId: number;
      itemId: string;
      label: string;
    }
  | {
      type: 'REORDER_SELECTIONS';
      tabId: number;
      orderedIds: string[];
    }
  | {
      type: 'UPSERT_NOTE';
      tabId: number;
      noteId?: string | undefined;
      label?: string | undefined;
      text: string;
      url: string;
    }
  | { type: 'COPY_MARKDOWN'; tabId: number }
  | { type: 'TOGGLE_CONTEXT'; tabId: number }
  | { type: 'GET_PICKER_STATE'; tabId: number }
  | {
      type: 'ADD_SELECTION_FROM_PAGE';
      selection: SelectionCapturePayload;
      pageContext: PageContextPayload;
    }
  | {
      type: 'TOGGLE_SELECTION_FROM_PAGE';
      selection: SelectionCapturePayload;
      pageContext: PageContextPayload;
    }
  | {
      type: 'SYNC_PAGE_CONTEXT';
      pageContext: PageContextPayload;
    };

export interface ExtensionResponse<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}
