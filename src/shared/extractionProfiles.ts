import {
  compactHtmlSnippet,
  extractVisibleTextFromElement,
  normalizeOptionalText,
} from '@/shared/selectionUtils';
import type {
  ExtractionBlockConfig,
  ExtractionProfileResult,
  RevealStep,
  SelectionCapturePayload,
  SelectionTable,
  SiteExtractionProfile,
} from '@/shared/types';

export const siteExtractionProfiles: SiteExtractionProfile[] = [
  {
    id: 'substack',
    hostnames: ['substack.com'],
    signals: ['article.typography.newsletter-post.post', 'h1.post-title.published'],
    anchorSelectors: [
      'article.typography.newsletter-post.post > .post-header > h1.post-title.published',
      'article.newsletter-post.post .post-header h1.post-title.published',
      'h1.post-title.published',
    ],
    blocks: [
      {
        type: 'heading',
        selectors: [
          'article.typography.newsletter-post.post > .post-header > h1.post-title.published',
          'article.newsletter-post.post .post-header h1.post-title.published',
        ],
        headingLevel: 1,
      },
      {
        type: 'heading',
        selectors: [
          'article.typography.newsletter-post.post > .post-header > h3.subtitle',
          'article.newsletter-post.post .post-header h3.subtitle',
        ],
        headingLevel: 3,
      },
      {
        type: 'paragraph',
        selectors: [
          'article.typography.newsletter-post.post .post-header .byline-wrapper a[href*="@"]',
        ],
      },
      {
        type: 'paragraph',
        selectors: [
          'article.typography.newsletter-post.post .post-header .byline-wrapper .pc-gap-4 > div',
        ],
      },
      {
        type: 'paragraph',
        selectors: [
          'article.typography.newsletter-post.post .available-content > .body.markup > blockquote',
          'article.typography.newsletter-post.post .available-content > .body.markup > p',
          'article.typography.newsletter-post.post .available-content > .body.markup > figure figcaption',
          'article.typography.newsletter-post.post .available-content > .body.markup > .captioned-image-container figcaption',
          'article.typography.newsletter-post.post .available-content > .body.markup > .captioned-image-container .caption',
        ],
      },
      {
        type: 'heading',
        selectors: [
          'article.typography.newsletter-post.post .available-content > .body.markup > h1',
        ],
        headingLevel: 2,
      },
      {
        type: 'heading',
        selectors: [
          'article.typography.newsletter-post.post .available-content > .body.markup > h2',
        ],
        headingLevel: 3,
      },
      {
        type: 'heading',
        selectors: [
          'article.typography.newsletter-post.post .available-content > .body.markup > h3',
        ],
        headingLevel: 4,
      },
      {
        type: 'heading',
        selectors: [
          'article.typography.newsletter-post.post .available-content > .body.markup > h4',
        ],
        headingLevel: 5,
      },
      {
        type: 'list',
        selectors: [
          'article.typography.newsletter-post.post .available-content > .body.markup > ul',
          'article.typography.newsletter-post.post .available-content > .body.markup > ol',
        ],
      },
      {
        type: 'image',
        selectors: [
          'article.typography.newsletter-post.post .available-content > .body.markup > figure img',
          'article.typography.newsletter-post.post .available-content > .body.markup > .captioned-image-container img',
          'article.typography.newsletter-post.post .available-content > .body.markup > img',
        ],
      },
    ],
  },
  {
    id: 'amazon',
    hostnames: ['amazon.com', 'amazon.es', 'amazon.com.mx', 'amazon.co.uk'],
    signals: ['#productTitle', '#dp-container'],
    anchorSelectors: ['#productTitle', '[data-automation-id="product-title"]'],
    reveal: [
      {
        type: 'click',
        selector: '#feature-bullets-expand',
        label: 'Expandir bullets del producto',
        optional: true,
        revealSelectors: ['#feature-bullets-hidden'],
      },
      {
        type: 'click',
        text: 'Detalles del producto',
        label: 'Expandir detalles del producto',
        optional: true,
        revealSelectors: ['#item_details'],
      },
      {
        type: 'click',
        text: 'Ver todas las especificaciones del producto',
        label: 'Abrir panel de especificaciones',
        optional: true,
        revealSelectors: [
          '#voyager-ns-desktop-side-sheet-container',
          '#voyager-ns-desktop-side-sheet-content',
        ],
      },
      {
        type: 'click',
        text: 'Ver más',
        label: 'Expandir overview',
        optional: true,
      },
      {
        type: 'click',
        text: 'Mostrar más',
        label: 'Expandir bullets parciales',
        optional: true,
      },
    ],
    blocks: [
      {
        type: 'heading',
        selectors: ['#productTitle', '[data-automation-id="product-title"]'],
        headingLevel: 1,
      },
      {
        type: 'paragraph',
        selectors: ['#corePriceDisplay_desktop_feature_div .a-offscreen'],
      },
      { type: 'paragraph', selectors: ['#sellerProfileTriggerId', '#bylineInfo'] },
      { type: 'paragraph', selectors: ['#availability span', '#outOfStock span'] },
      { type: 'image', selectors: ['#landingImage', '#imgTagWrapperId img'] },
      {
        type: 'heading',
        selectors: ['#pqv-feature-bullets-heading'],
        headingLevel: 2,
      },
      {
        type: 'list',
        selectors: [
          '#pqv-feature-bullets > ul',
          '#feature-bullets > ul',
          '#feature-bullets-hidden > ul',
        ],
      },
      {
        type: 'heading',
        selectors: ['#pqv-description-heading'],
        headingLevel: 2,
      },
      {
        type: 'paragraph',
        selectors: ['#pqv-description > div'],
      },
      {
        type: 'heading',
        selectors: [
          '#pqv-important-information-heading',
          '#important-information > h2',
          '#importantInformation_feature_div #important-information > h2',
        ],
        headingLevel: 2,
      },
      {
        type: 'heading',
        selectors: [
          '#pqv-important-information > h3',
          '#important-information .content > h3',
          '#important-information .content > h4',
          '#importantInformation_feature_div #important-information .content > h3',
          '#importantInformation_feature_div #important-information .content > h4',
        ],
        headingLevel: 3,
      },
      {
        type: 'paragraph',
        selectors: [
          '#pqv-important-information > p',
          '#important-information .content > p',
          '#importantInformation_feature_div #important-information .content > p',
        ],
      },
      {
        type: 'table',
        selectors: [
          '#item_details table',
          '#voyager-ns-desktop-side-sheet-content table',
          '#productOverview_feature_div table',
          '#productFactsDesktop_feature_div table',
          '#productDetails_feature_div table',
        ],
      },
      {
        type: 'heading',
        selectors: ['#voyager-ns-desktop-side-sheet-content > h1'],
        headingLevel: 2,
      },
      {
        type: 'heading',
        selectors: ['#voyager-ns-desktop-side-sheet-content h2'],
        headingLevel: 3,
      },
    ],
  },
];

function matchesProfile(profile: SiteExtractionProfile, document: Document, url: URL): boolean {
  const hostnameMatch =
    profile.hostnames?.some(
      (hostname) => url.hostname === hostname || url.hostname.endsWith(`.${hostname}`),
    ) ?? false;
  const signalMatch =
    profile.signals?.some((selector) => document.querySelector(selector) != null) ?? false;

  return hostnameMatch || signalMatch;
}

function buildOrderKey(element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current != null && current !== current.ownerDocument.documentElement) {
    const parent: Element | null = current.parentElement;
    if (parent == null) {
      break;
    }

    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(current);
    segments.unshift(String(Math.max(0, index)).padStart(4, '0'));
    current = parent;
  }

  return segments.join('.');
}

function buildSelectorHint(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current != null && parts.length < 5) {
    const tagName = current.tagName.toLowerCase();
    const id = current.getAttribute('id');
    if (id != null && id.length > 0) {
      parts.unshift(`${tagName}#${id}`);
      break;
    }

    if (current.parentElement == null) {
      parts.unshift(tagName);
      break;
    }

    const className = normalizeOptionalText(current.getAttribute('class'))
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .join('.');
    const siblings = Array.from(current.parentElement.children).filter(
      (sibling) => sibling.tagName === current?.tagName,
    );
    const index = siblings.indexOf(current) + 1;
    const nthOfType = `:nth-of-type(${index})`;
    const suffix =
      className != null ? `.${className}${siblings.length > 1 ? nthOfType : ''}` : nthOfType;
    parts.unshift(`${tagName}${suffix}`);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

function buildSelectionKey(format: SelectionCapturePayload['format'], element: Element): string {
  return `${format}:${buildSelectorHint(element)}`;
}

function buildHtmlSnippet(element: Element): string | undefined {
  return compactHtmlSnippet(element.outerHTML);
}

function anchorElement(document: Document, profile: SiteExtractionProfile): Element | null {
  for (const selector of profile.anchorSelectors ?? []) {
    const element = document.querySelector(selector);
    if (element != null) {
      return element;
    }
  }

  return null;
}

function extractList(listElement: Element): SelectionCapturePayload | null {
  const items = Array.from(listElement.querySelectorAll(':scope > li'))
    .map((item) => normalizeOptionalText(extractVisibleTextFromElement(item)))
    .filter((item): item is string => item != null);

  if (items.length === 0) {
    return null;
  }

  return {
    kind: 'element',
    format: 'list',
    orderKey: buildOrderKey(listElement),
    selectionKey: buildSelectionKey('list', listElement),
    text: items.join(' · '),
    listItems: items,
    orderedList: listElement.tagName.toLowerCase() === 'ol',
    htmlSnippet: buildHtmlSnippet(listElement),
    selectorHint: buildSelectorHint(listElement),
  };
}

function extractTable(tableElement: Element): SelectionCapturePayload | null {
  if (!(tableElement instanceof HTMLTableElement)) {
    return null;
  }

  const rows = Array.from(tableElement.querySelectorAll('tr'))
    .map((row) =>
      Array.from(row.children)
        .filter(
          (cell): cell is HTMLTableCellElement =>
            cell.tagName.toLowerCase() === 'td' || cell.tagName.toLowerCase() === 'th',
        )
        .map((cell) => normalizeOptionalText(extractVisibleTextFromElement(cell)))
        .filter((cell): cell is string => cell != null),
    )
    .filter((row) => row.length > 0);

  if (rows.length === 0) {
    return null;
  }

  const headerRow = Array.from(tableElement.querySelectorAll('tr')).find((row) =>
    Array.from(row.children).every((cell) => cell.tagName.toLowerCase() === 'th'),
  );
  const table: SelectionTable = {
    headers:
      headerRow == null
        ? []
        : Array.from(headerRow.children)
            .map((cell) => normalizeOptionalText(extractVisibleTextFromElement(cell)))
            .filter((cell): cell is string => cell != null),
    rows: rows,
  };

  return {
    kind: 'element',
    format: 'table',
    orderKey: buildOrderKey(tableElement),
    selectionKey: buildSelectionKey('table', tableElement),
    text: table.rows.map((row) => row.join(' | ')).join(' / '),
    table,
    htmlSnippet: buildHtmlSnippet(tableElement),
    selectorHint: buildSelectorHint(tableElement),
  };
}

function extractFromBlock(
  block: ExtractionBlockConfig,
  element: Element,
): SelectionCapturePayload | null {
  switch (block.type) {
    case 'heading': {
      const text = normalizeOptionalText(extractVisibleTextFromElement(element));
      if (text == null) {
        return null;
      }

      return {
        kind: 'element',
        format: 'heading',
        orderKey: buildOrderKey(element),
        selectionKey: buildSelectionKey('heading', element),
        text,
        headingLevel: block.headingLevel ?? 2,
        htmlSnippet: buildHtmlSnippet(element),
        selectorHint: buildSelectorHint(element),
      };
    }
    case 'paragraph': {
      const text = normalizeOptionalText(extractVisibleTextFromElement(element));
      if (text == null) {
        return null;
      }

      return {
        kind: 'element',
        format: 'paragraph',
        orderKey: buildOrderKey(element),
        selectionKey: buildSelectionKey('paragraph', element),
        text,
        htmlSnippet: buildHtmlSnippet(element),
        selectorHint: buildSelectorHint(element),
      };
    }
    case 'list':
      return extractList(element);
    case 'table':
      return extractTable(element);
    case 'image': {
      if (!(element instanceof HTMLImageElement)) {
        return null;
      }

      const imageUrl = element.currentSrc || element.src;
      if (imageUrl.length === 0) {
        return null;
      }

      return {
        kind: 'image',
        format: 'image',
        orderKey: buildOrderKey(element),
        selectionKey: buildSelectionKey('image', element),
        text: normalizeOptionalText(element.alt) ?? 'Imagen capturada',
        imageUrl,
        selectorHint: buildSelectorHint(element),
      };
    }
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeEntityLiterals(value: string): string {
  return value
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replaceAll('&nbsp;', ' ');
}

function normalizeComparableText(value: string): string {
  return normalizeText(decodeEntityLiterals(value));
}

const AMAZON_NOISE_PATTERNS: RegExp[] = [
  /^enviar a\b/i,
  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .-]+\d{5,}\s*$/u,
  /^agregar a la lista$/i,
  /^agregado a$/i,
  /^no se puede agregar el artículo a la lista\b/i,
  /^hubo un error al recuperar tus listas de deseos\b/i,
  /^lista no disponible\.?$/i,
  /^no puede enviarse este producto al punto de entrega seleccionado\b/i,
];

const SUBSTACK_NOISE_PATTERNS: RegExp[] = [
  /^the cosmobiologist$/i,
  /^subscribe$/i,
  /^sign in$/i,
  /^share$/i,
  /^comments?$/i,
  /reader-supported publication/i,
  /^subscribe to\b/i,
];

function isAmazonNoiseSelection(
  selection: SelectionCapturePayload,
  anchorText: string | null,
): boolean {
  if (selection.format === 'image') {
    return true;
  }

  if (selection.format !== 'paragraph') {
    return false;
  }

  const comparableText = normalizeComparableText(selection.text);
  if (comparableText.length === 0) {
    return false;
  }

  if (anchorText != null && comparableText === anchorText) {
    return true;
  }

  return AMAZON_NOISE_PATTERNS.some((pattern) => pattern.test(comparableText));
}

function isSubstackNoiseSelection(
  selection: SelectionCapturePayload,
  anchorText: string | null,
): boolean {
  const comparableText = normalizeComparableText(selection.text);
  if (comparableText.length === 0) {
    return false;
  }

  if (anchorText != null && selection.format !== 'heading' && comparableText === anchorText) {
    return true;
  }

  if (SUBSTACK_NOISE_PATTERNS.some((pattern) => pattern.test(comparableText))) {
    return true;
  }

  return (
    selection.selectorHint?.includes('subscription-widget') === true ||
    selection.selectorHint?.includes('comment') === true
  );
}

function isSimpleKeyValueTable(selection: SelectionCapturePayload): boolean {
  return (
    selection.format === 'table' &&
    selection.table != null &&
    selection.table.rows.length > 0 &&
    selection.table.rows.every((row) => row.length === 2)
  );
}

function isVoyagerSideSheetSelection(selection: SelectionCapturePayload): boolean {
  return selection.selectorHint?.includes('#voyager-ns-desktop-side-sheet-content') ?? false;
}

function isAmazonMergeCandidate(selection: SelectionCapturePayload): boolean {
  return (
    isVoyagerSideSheetSelection(selection) &&
    (selection.format === 'heading' || isSimpleKeyValueTable(selection))
  );
}

function mergeAmazonSpecTables(selections: SelectionCapturePayload[]): SelectionCapturePayload[] {
  const firstVoyagerIndex = selections.findIndex((selection) => isAmazonMergeCandidate(selection));
  const voyagerTables = selections.filter(
    (selection) => isVoyagerSideSheetSelection(selection) && isSimpleKeyValueTable(selection),
  );

  if (firstVoyagerIndex === -1 || voyagerTables.length < 2) {
    return selections;
  }

  const rowKeys = new Set<string>();
  const rows = voyagerTables.flatMap((tableSelection) =>
    (tableSelection.table?.rows ?? []).filter((row) => {
      const key = row.join('\u241f');
      if (rowKeys.has(key)) {
        return false;
      }
      rowKeys.add(key);
      return true;
    }),
  );
  const firstTable = voyagerTables[0];
  if (firstTable == null) {
    return selections;
  }

  const mergedTable: SelectionCapturePayload = {
    ...firstTable,
    text: rows.map((row) => row.join(' | ')).join(' / '),
    table: {
      headers: ['Campo', 'Valor'],
      rows,
    },
  };

  const normalizedSelections: SelectionCapturePayload[] = [];
  let insertedMergedTable = false;

  selections.forEach((selection, index) => {
    if (index === firstVoyagerIndex && !insertedMergedTable) {
      normalizedSelections.push(mergedTable);
      insertedMergedTable = true;
    }

    if (isAmazonMergeCandidate(selection)) {
      return;
    }

    normalizedSelections.push(selection);
  });

  if (!insertedMergedTable) {
    normalizedSelections.push(mergedTable);
  }

  return normalizedSelections;
}

function normalizeAmazonSelections(
  selections: SelectionCapturePayload[],
  anchorText: string | null,
): SelectionCapturePayload[] {
  const filteredSelections = selections.filter(
    (selection) => !isAmazonNoiseSelection(selection, anchorText),
  );

  return normalizeAmazonImportantInformation(mergeAmazonSpecTables(filteredSelections));
}

function normalizeSubstackSelections(
  selections: SelectionCapturePayload[],
  anchorText: string | null,
): SelectionCapturePayload[] {
  return selections.filter((selection) => !isSubstackNoiseSelection(selection, anchorText));
}

function isAmazonImportantInformationSelection(selection: SelectionCapturePayload): boolean {
  return (
    selection.selectorHint?.includes('#pqv-important-information') === true ||
    selection.selectorHint?.includes('#important-information') === true ||
    selection.selectorHint?.includes('#importantInformation_feature_div') === true
  );
}

function normalizeAmazonImportantInformation(
  selections: SelectionCapturePayload[],
): SelectionCapturePayload[] {
  const normalizedSelections: SelectionCapturePayload[] = [];
  const seenImportantInfoEntries = new Set<string>();

  selections.forEach((selection) => {
    if (!isAmazonImportantInformationSelection(selection)) {
      normalizedSelections.push(selection);
      return;
    }

    const comparableText = normalizeComparableText(selection.text);
    if (comparableText.length === 0) {
      return;
    }

    const signature =
      selection.format === 'heading'
        ? `${selection.format}:${selection.headingLevel ?? 0}:${comparableText}`
        : `${selection.format}:${comparableText}`;

    if (seenImportantInfoEntries.has(signature)) {
      return;
    }

    seenImportantInfoEntries.add(signature);
    normalizedSelections.push(selection);
  });

  return normalizedSelections;
}

function resolveRevealTrigger(document: Document, step: RevealStep) {
  if (step == null) {
    return null;
  }

  if (step.selector != null) {
    const trigger = document.querySelector(step.selector);
    if (trigger instanceof HTMLElement) {
      return trigger;
    }
  }

  if (step.text == null) {
    return null;
  }

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button, a, summary, [role="button"], .a-expander-header',
    ),
  );

  return (
    candidates.find((candidate) => normalizeText(candidate.textContent ?? '') === step.text) ?? null
  );
}

function revealElement(element: Element): void {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.hidden = false;
  element.removeAttribute('hidden');
  if (element.getAttribute('aria-hidden') === 'true') {
    element.setAttribute('aria-hidden', 'false');
  }
  if (element.style.display === 'none') {
    element.style.display = 'block';
  }
  if (element.style.visibility === 'hidden') {
    element.style.visibility = 'visible';
  }
  if (element.style.maxHeight.length > 0 && element.style.maxHeight !== 'none') {
    element.style.maxHeight = 'none';
  }
  element.classList.remove('aok-hidden');
}

function runRevealStep(document: Document, step: RevealStep): boolean {
  const trigger = resolveRevealTrigger(document, step);
  if (!(trigger instanceof HTMLElement)) {
    return false;
  }

  trigger.click();
  const controlsId = trigger.getAttribute('aria-controls');
  if (controlsId != null) {
    const controlled = document.getElementById(controlsId);
    if (controlled instanceof Element) {
      revealElement(controlled);
      trigger.setAttribute('aria-expanded', 'true');
    }
  }

  step.revealSelectors?.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      revealElement(element);
    });
  });

  return true;
}

export function extractWithSiteProfile(
  document: Document,
  url: URL,
  profiles: SiteExtractionProfile[] = siteExtractionProfiles,
): ExtractionProfileResult | null {
  const profile = profiles.find((candidate) => matchesProfile(candidate, document, url));
  if (profile == null) {
    return null;
  }

  let revealApplied = false;
  profile.reveal?.forEach((step) => {
    if (runRevealStep(document, step)) {
      revealApplied = true;
    }
  });

  const selections: SelectionCapturePayload[] = [];
  const seen = new Set<string>();

  profile.blocks.forEach((block) => {
    block.selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        const selection = extractFromBlock(block, element);
        if (selection == null) {
          return;
        }

        const signature = `${selection.format}:${selection.selectionKey ?? selection.text}:${selection.imageUrl ?? ''}`;
        if (seen.has(signature)) {
          return;
        }

        seen.add(signature);
        selections.push(selection);
      });
    });
  });

  if (selections.length === 0) {
    return null;
  }

  const normalizeSelectionsForProfile = (
    orderedSelections: SelectionCapturePayload[],
    comparableAnchorText: string | null,
  ): SelectionCapturePayload[] => {
    switch (profile.id) {
      case 'amazon':
        return normalizeAmazonSelections(orderedSelections, comparableAnchorText);
      case 'substack':
        return normalizeSubstackSelections(orderedSelections, comparableAnchorText);
      default:
        return orderedSelections;
    }
  };

  const anchor = anchorElement(document, profile);
  if (anchor == null) {
    const sortedSelections = selections.sort((left, right) =>
      (left.orderKey ?? '').localeCompare(right.orderKey ?? ''),
    );
    return {
      profileId: profile.id,
      revealApplied,
      selections: normalizeSelectionsForProfile(sortedSelections, null),
    };
  }

  const anchorOrderKey = buildOrderKey(anchor);
  const anchorText = normalizeOptionalText(extractVisibleTextFromElement(anchor));
  const comparableAnchorText = anchorText == null ? null : normalizeComparableText(anchorText);
  const anchoredSelections = selections.filter((selection) => {
    if (comparableAnchorText == null) {
      return true;
    }

    return !(
      selection.format !== 'heading' &&
      normalizeComparableText(selection.text) === comparableAnchorText
    );
  });

  const orderedSelections = anchoredSelections.sort((left, right) => {
    const leftIsAnchor = left.format === 'heading' && left.orderKey === anchorOrderKey;
    const rightIsAnchor = right.format === 'heading' && right.orderKey === anchorOrderKey;

    if (leftIsAnchor && !rightIsAnchor) {
      return -1;
    }

    if (!leftIsAnchor && rightIsAnchor) {
      return 1;
    }

    return (left.orderKey ?? '').localeCompare(right.orderKey ?? '');
  });

  return {
    profileId: profile.id,
    revealApplied,
    selections: normalizeSelectionsForProfile(orderedSelections, comparableAnchorText),
  };
}
