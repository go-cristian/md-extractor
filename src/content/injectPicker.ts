import type {
  PageContextPayload,
  PrimaryCapturePayload,
  SelectionCapturePayload,
  SelectionTable,
} from '@/shared/types';

export function runPickerAction(
  action: 'activate' | 'deactivate' | 'capturePrimary' | 'syncHighlights',
  highlights: Array<{ selectionKey: string; selectorHint: string }> = [],
): PrimaryCapturePayload | undefined {
  interface MetadataDraft {
    title: string;
    price?: string | undefined;
    currency?: string | undefined;
    seller?: string | undefined;
    rating?: string | undefined;
    availability?: string | undefined;
    heroImageUrl?: string | undefined;
  }

  interface PickerRuntime {
    active: boolean;
    overlay: HTMLDivElement;
    activate(): void;
    deactivate(): void;
    syncHighlights(highlights: Array<{ selectionKey: string; selectorHint: string }>): void;
  }

  const NOISY_SELECTOR =
    'script, style, noscript, template, svg, iframe, canvas, link, meta, [hidden], [aria-hidden="true"]';
  const INLINE_TAGS = new Set([
    'A',
    'ABBR',
    'B',
    'EM',
    'I',
    'LABEL',
    'SMALL',
    'SPAN',
    'STRONG',
    'SUB',
    'SUP',
  ]);
  const PRIMARY_ROOT_SELECTORS = [
    '#centerCol',
    '#dp-container',
    '#ppd',
    '[role="main"]',
    'main article',
    'main',
    'article',
    '.product-card',
  ];
  const MANUAL_MIN_TEXT = 40;
  const MANUAL_MAX_TEXT = 800;
  const PRIMARY_PARAGRAPH_MAX = 700;

  function normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  function normalizeLineText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  function normalizeOptionalText(value: string | null | undefined): string | undefined {
    if (value == null) {
      return undefined;
    }

    const normalized = normalizeText(value);
    return normalized.length > 0 ? normalized : undefined;
  }

  function removeNoisyDescendants(root: Element): void {
    root.querySelectorAll(NOISY_SELECTOR).forEach((node) => {
      node.remove();
    });
  }

  function isHiddenElement(element: Element): boolean {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
      return true;
    }

    const style = window.getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden';
  }

  function extractVisibleText(element: Element): string {
    if (element instanceof HTMLElement) {
      const visibleText = normalizeOptionalText(element.innerText);
      if (visibleText != null) {
        return visibleText;
      }
    }

    const clone = element.cloneNode(true);
    if (!(clone instanceof Element)) {
      return normalizeOptionalText(element.textContent) ?? '';
    }

    removeNoisyDescendants(clone);
    return normalizeOptionalText(clone.textContent) ?? '';
  }

  function buildHtmlSnippet(element: Element): string | undefined {
    const clone = element.cloneNode(true);
    if (!(clone instanceof Element)) {
      return compactHtmlSnippet(element.outerHTML);
    }

    removeNoisyDescendants(clone);
    return compactHtmlSnippet(clone.outerHTML);
  }

  function extractStructuredText(element: Element): string {
    if (element instanceof HTMLElement) {
      return element.innerText;
    }

    const clone = element.cloneNode(true);
    if (!(clone instanceof Element)) {
      return element.textContent ?? '';
    }

    removeNoisyDescendants(clone);
    return clone.textContent ?? '';
  }

  function inferListFromText(value: string): { items: string[]; ordered: boolean } | null {
    const lines = value.split(/\r?\n/).map(normalizeLineText).filter(Boolean);
    if (lines.length < 2) {
      return null;
    }

    const unorderedMatches = lines.map((line) => line.match(/^[-*•◦·]\s+(.+)$/));
    if (unorderedMatches.every((match): match is RegExpMatchArray => match != null)) {
      return {
        items: unorderedMatches.map((match) => normalizeText(match[1] ?? '')),
        ordered: false,
      };
    }

    const orderedMatches = lines.map((line) => line.match(/^(\d+)[.)]\s+(.+)$/));
    if (orderedMatches.every((match): match is RegExpMatchArray => match != null)) {
      const numbers = orderedMatches.map((match) => Number(match[1]));
      const isSequential = numbers.every((number, index) => {
        if (index === 0) {
          return true;
        }

        const previous = numbers[index - 1];
        return previous != null && number === previous + 1;
      });

      if (!isSequential) {
        return null;
      }

      return {
        items: orderedMatches.map((match) => normalizeText(match[2] ?? '')),
        ordered: true,
      };
    }

    return null;
  }

  function headingElement(target: Element): Element | null {
    return target.closest(
      '#productTitle, [data-automation-id="product-title"], h1, h2, h3, h4, h5, h6, [role="heading"]',
    );
  }

  function isHeadingNode(element: Element): boolean {
    return headingElement(element) === element;
  }

  function headingLevel(element: Element): number {
    const tagName = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tagName)) {
      return Number(tagName.slice(1));
    }

    const ariaLevel = Number(element.getAttribute('aria-level'));
    if (Number.isInteger(ariaLevel) && ariaLevel >= 1 && ariaLevel <= 6) {
      return ariaLevel;
    }

    return 2;
  }

  function extractListData(element: Element): { items: string[]; ordered: boolean } | null {
    const list = element.matches('ul, ol') ? element : element.closest('ul, ol');
    if (!(list instanceof HTMLUListElement || list instanceof HTMLOListElement)) {
      return null;
    }

    const items = Array.from(list.children)
      .filter((child): child is HTMLLIElement => child instanceof HTMLLIElement)
      .map((item) => extractVisibleText(item))
      .filter((item) => item.length > 0);

    if (items.length === 0) {
      return null;
    }

    return {
      items,
      ordered: list instanceof HTMLOListElement,
    };
  }

  function extractTableData(element: Element): SelectionTable | null {
    const table = element.matches('table') ? element : element.closest('table');
    if (!(table instanceof HTMLTableElement)) {
      return null;
    }

    const rows = Array.from(table.querySelectorAll('tr'))
      .map((row) =>
        Array.from(row.children)
          .filter(
            (cell): cell is HTMLTableCellElement =>
              cell.tagName.toLowerCase() === 'td' || cell.tagName.toLowerCase() === 'th',
          )
          .map((cell) => extractVisibleText(cell))
          .filter((cell) => cell.length > 0),
      )
      .filter((row) => row.length > 0);

    if (rows.length === 0) {
      return null;
    }

    const firstRow = rows[0] ?? [];
    const headerRow = Array.from(table.querySelectorAll('tr')).find((row) =>
      Array.from(row.children).every((cell) => cell.tagName.toLowerCase() === 'th'),
    );
    const headers =
      headerRow == null
        ? []
        : Array.from(headerRow.children)
            .map((cell) => extractVisibleText(cell))
            .filter((cell) => cell.length > 0);

    const dataRows =
      headers.length > 0 && firstRow.join(' ') === headers.join(' ') ? rows.slice(1) : rows;

    return {
      headers,
      rows: dataRows,
    };
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

      const className = normalizeOptionalText(current.getAttribute('class'))
        ?.split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .join('.');
      const siblings =
        current.parentElement == null
          ? []
          : Array.from(current.parentElement.children).filter(
              (sibling) => sibling.tagName === current?.tagName,
            );
      const index = siblings.indexOf(current) + 1;
      const suffix = className != null ? `.${className}` : `:nth-of-type(${index})`;
      parts.unshift(`${tagName}${suffix}`);
      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  function buildSelectionKey(format: SelectionCapturePayload['format'], element: Element): string {
    return `${format}:${buildSelectorHint(element)}`;
  }

  function compactHtmlSnippet(value: string): string | undefined {
    const maxLength = 240;
    return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
  }

  function isInlineElement(element: Element): boolean {
    return INLINE_TAGS.has(element.tagName);
  }

  function getBlockChildren(element: Element): Element[] {
    return Array.from(element.children).filter(
      (child) =>
        !isHiddenElement(child) && !child.matches(NOISY_SELECTOR) && !isInlineElement(child),
    );
  }

  function hasMeaningfulContent(element: Element): boolean {
    if (element instanceof HTMLImageElement) {
      return (element.currentSrc || element.src).length > 0;
    }

    return extractVisibleText(element).length > 0;
  }

  function splitParagraphsFromElement(element: Element): string[] {
    const structuredText = extractStructuredText(element);
    const inferredList = inferListFromText(structuredText);
    if (inferredList != null) {
      return inferredList.items;
    }

    const lines = structuredText.split(/\r?\n/).map(normalizeLineText).filter(Boolean);
    if (lines.length === 0) {
      const text = extractVisibleText(element);
      return text.length > 0 ? [text] : [];
    }

    const merged: string[] = [];
    let current = '';
    for (const line of lines) {
      if (current.length === 0) {
        current = line;
        continue;
      }

      if (`${current} ${line}`.length <= PRIMARY_PARAGRAPH_MAX) {
        current = `${current} ${line}`;
        continue;
      }

      merged.push(current);
      current = line;
    }

    if (current.length > 0) {
      merged.push(current);
    }

    return merged;
  }

  function appendUniqueSelection(
    selections: SelectionCapturePayload[],
    seen: Set<string>,
    selection: SelectionCapturePayload,
  ): void {
    const normalizedText = normalizeOptionalText(selection.text) ?? '';
    const normalizedListItems =
      selection.listItems?.map((item) => normalizeText(item)) ?? undefined;
    const signature = `${selection.format}:${normalizedText}:${selection.imageUrl ?? ''}`;

    if (
      (selection.format !== 'image' && normalizedText.length === 0) ||
      (selection.format === 'image' && normalizedText.length === 0 && selection.imageUrl == null) ||
      seen.has(signature)
    ) {
      return;
    }

    seen.add(signature);
    selections.push({
      ...selection,
      text: normalizedText,
      listItems: normalizedListItems,
    });
  }

  function appendParagraphSelection(
    element: Element,
    selections: SelectionCapturePayload[],
    seen: Set<string>,
  ): void {
    const structuredText = extractStructuredText(element);
    const inferredList = inferListFromText(structuredText);
    if (inferredList != null) {
      appendUniqueSelection(selections, seen, {
        kind: 'element',
        format: 'list',
        selectionKey: buildSelectionKey('list', element),
        text: inferredList.items.join(' · '),
        listItems: inferredList.items,
        orderedList: inferredList.ordered,
        htmlSnippet: buildHtmlSnippet(element),
        selectorHint: buildSelectorHint(element),
      });
      return;
    }

    const paragraph = splitParagraphsFromElement(element).join('\n\n');
    appendUniqueSelection(selections, seen, {
      kind: 'element',
      format: 'paragraph',
      selectionKey: buildSelectionKey('paragraph', element),
      text: paragraph,
      htmlSnippet: buildHtmlSnippet(element),
      selectorHint: buildSelectorHint(element),
    });
  }

  function collectPrimarySelections(root: Element): SelectionCapturePayload[] {
    const selections: SelectionCapturePayload[] = [];
    const seen = new Set<string>();

    function visit(element: Element): void {
      if (isHiddenElement(element) || element.matches(NOISY_SELECTOR)) {
        return;
      }

      if (isHeadingNode(element)) {
        appendUniqueSelection(selections, seen, {
          kind: 'element',
          format: 'heading',
          selectionKey: buildSelectionKey('heading', element),
          text: extractVisibleText(element),
          headingLevel: headingLevel(element),
          htmlSnippet: buildHtmlSnippet(element),
          selectorHint: buildSelectorHint(element),
        });
        return;
      }

      if (element.matches('table')) {
        const table = extractTableData(element);
        if (table != null) {
          appendUniqueSelection(selections, seen, {
            kind: 'element',
            format: 'table',
            selectionKey: buildSelectionKey('table', element),
            text: table.rows.map((row) => row.join(' | ')).join(' / '),
            table,
            htmlSnippet: buildHtmlSnippet(element),
            selectorHint: buildSelectorHint(element),
          });
        }
        return;
      }

      if (element.matches('ul, ol')) {
        const list = extractListData(element);
        if (list != null) {
          appendUniqueSelection(selections, seen, {
            kind: 'element',
            format: 'list',
            selectionKey: buildSelectionKey('list', element),
            text: list.items.join(' · '),
            listItems: list.items,
            orderedList: list.ordered,
            htmlSnippet: buildHtmlSnippet(element),
            selectorHint: buildSelectorHint(element),
          });
        }
        return;
      }

      if (element instanceof HTMLImageElement) {
        appendUniqueSelection(selections, seen, {
          kind: 'image',
          format: 'image',
          selectionKey: buildSelectionKey('image', element),
          text: normalizeOptionalText(element.alt) ?? 'Imagen capturada',
          imageUrl: element.currentSrc || element.src,
          selectorHint: buildSelectorHint(element),
        });
        return;
      }

      if (element.matches('p')) {
        appendParagraphSelection(element, selections, seen);
        return;
      }

      const children = getBlockChildren(element).filter(hasMeaningfulContent);
      if (children.length === 0) {
        appendParagraphSelection(element, selections, seen);
        return;
      }

      children.forEach((child) => {
        visit(child);
      });
    }

    const roots = getBlockChildren(root).filter(hasMeaningfulContent);
    if (roots.length === 0) {
      visit(root);
    } else {
      roots.forEach((child) => {
        visit(child);
      });
    }

    return selections;
  }

  function findPrimaryContentRoot(): Element | null {
    for (const selector of PRIMARY_ROOT_SELECTORS) {
      const candidate = document.querySelector(selector);
      if (candidate != null && hasMeaningfulContent(candidate)) {
        return candidate;
      }
    }

    const title = document.querySelector('#productTitle, [data-automation-id="product-title"], h1');
    if (title != null) {
      return (
        title.closest('#centerCol, #dp-container, main, [role="main"], article, section') ??
        title.parentElement
      );
    }

    return document.body;
  }

  function findSemanticContainer(initial: Element): Element {
    if (initial instanceof HTMLImageElement) {
      return initial;
    }

    const semanticMatch = initial.closest(
      'p, li, article, section, [data-component], [data-testid], [itemprop]',
    );
    if (semanticMatch != null) {
      const semanticTextLength = extractVisibleText(semanticMatch).length;
      if (semanticTextLength >= MANUAL_MIN_TEXT && semanticTextLength <= MANUAL_MAX_TEXT) {
        return semanticMatch;
      }
    }

    if (extractVisibleText(initial).length >= MANUAL_MIN_TEXT) {
      return initial;
    }

    let current: Element = initial;
    for (let depth = 0; depth < 4 && current.parentElement != null; depth += 1) {
      const next = current.parentElement;
      const textLength = extractVisibleText(next).length;
      if (textLength >= MANUAL_MIN_TEXT && textLength <= MANUAL_MAX_TEXT) {
        return next;
      }

      current = next;
    }

    if (semanticMatch != null) {
      return semanticMatch;
    }

    return initial;
  }

  function detectSiteName(): string {
    return window.location.hostname.replace(/^www\./i, '');
  }

  function readText(selectors: string[]): string | undefined {
    for (const selector of selectors) {
      const element = document.querySelector<HTMLElement>(selector);
      const text = element == null ? undefined : normalizeOptionalText(extractVisibleText(element));
      if (text != null) {
        return text;
      }
    }
    return undefined;
  }

  function readMeta(selector: string): string | undefined {
    const element = document.querySelector<HTMLMetaElement>(selector);
    return normalizeOptionalText(element?.content);
  }

  function readAttribute(selectors: string[], attribute: string): string | undefined {
    for (const selector of selectors) {
      const element = document.querySelector<HTMLElement>(selector);
      const value = normalizeOptionalText(element?.getAttribute(attribute));
      if (value != null) {
        return value;
      }
    }

    return undefined;
  }

  function extractMetadata(): MetadataDraft {
    const hostname = window.location.hostname;
    const metadata: MetadataDraft = {
      title: readMeta('meta[property="og:title"]') ?? readText(['h1']) ?? document.title,
    };

    const genericPrice =
      readMeta('meta[property="product:price:amount"]') ??
      readText(['[itemprop="price"]', '.price', '[data-price]']);
    if (genericPrice != null) {
      metadata.price = genericPrice;
    }

    const genericCurrency = readMeta('meta[property="product:price:currency"]');
    if (genericCurrency != null) {
      metadata.currency = genericCurrency;
    }

    const genericImage = readMeta('meta[property="og:image"]');
    if (genericImage != null) {
      metadata.heroImageUrl = genericImage;
    }

    if (
      /(^|\.)amazon\./i.test(hostname) ||
      document.querySelector('#productTitle') != null ||
      document.querySelector('#acrPopover') != null
    ) {
      metadata.title =
        readText(['#productTitle', '[data-automation-id="product-title"]']) ?? metadata.title;
      const amazonPrice = readText([
        '.a-price .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-offscreen',
      ]);
      const amazonSeller = readText(['#sellerProfileTriggerId', '#bylineInfo']);
      const amazonRating = readText([
        '#acrPopover [aria-hidden="true"]',
        '[data-hook="rating-out-of-text"]',
      ]);
      const amazonAvailability = readText(['#availability span', '#outOfStock span']);
      const amazonImage = readAttribute(['#landingImage', '#imgTagWrapperId img'], 'src');

      if (amazonPrice != null) {
        metadata.price = amazonPrice;
      }
      if (amazonSeller != null) {
        metadata.seller = amazonSeller;
      }
      if (amazonRating != null) {
        metadata.rating = amazonRating;
      }
      if (amazonAvailability != null) {
        metadata.availability = amazonAvailability;
      }
      if (amazonImage != null) {
        metadata.heroImageUrl = amazonImage;
      }
    } else if (
      /myshopify\.com$/i.test(hostname) ||
      document.querySelector('meta[name="shopify-digital-wallet"]') != null ||
      document.documentElement.innerHTML.includes('Shopify.theme')
    ) {
      metadata.title =
        readText(['[data-product-title]', '.product__title', '.product-single__title', 'h1']) ??
        metadata.title;
      const shopifyPrice = readText([
        '[data-product-price]',
        '.price-item--regular',
        '.product__price',
        '.price',
      ]);
      const shopifySeller = readMeta('meta[property="product:brand"]');
      const shopifyAvailability = readText([
        '[data-product-inventory-status]',
        '.product-form__inventory',
        '[data-inventory-status]',
      ]);
      const shopifyImage = readAttribute(
        ['.product__media img', '.product-featured-media img'],
        'src',
      );

      if (shopifyPrice != null) {
        metadata.price = shopifyPrice;
      }
      if (shopifySeller != null) {
        metadata.seller = shopifySeller;
      }
      if (shopifyAvailability != null) {
        metadata.availability = shopifyAvailability;
      }
      if (shopifyImage != null) {
        metadata.heroImageUrl = shopifyImage;
      }
    }

    return metadata;
  }

  function createPageContext(): PageContextPayload {
    return {
      url: window.location.href,
      origin: window.location.origin,
      pageTitle: document.title,
      siteName: detectSiteName(),
      metadata: extractMetadata(),
    };
  }

  function capturePrimaryContent(): PrimaryCapturePayload {
    const pageContext = createPageContext();
    const root = findPrimaryContentRoot();
    const selections = root == null ? [] : collectPrimarySelections(root);

    return {
      pageContext,
      selections,
    };
  }

  if (action === 'capturePrimary') {
    return capturePrimaryContent();
  }

  const globalKey = '__MD_EXTRACTOR_PICKER__';
  const runtimeHost = globalThis as typeof globalThis & {
    [globalKey]?: PickerRuntime;
  };

  if (runtimeHost[globalKey] != null) {
    if (action === 'activate') {
      runtimeHost[globalKey]?.activate();
    }
    if (action === 'deactivate') {
      runtimeHost[globalKey]?.deactivate();
    }
    if (action === 'syncHighlights') {
      runtimeHost[globalKey]?.syncHighlights(highlights);
    }
    return undefined;
  }

  if (action !== 'activate') {
    return undefined;
  }

  const overlay = document.createElement('div');
  const overlayDataset = overlay.dataset as DOMStringMap & { mdExtractorOverlay?: string };
  overlayDataset.mdExtractorOverlay = 'true';
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '2147483647';
  overlay.style.border = '2px solid #0f766e';
  overlay.style.background = 'rgba(15, 118, 110, 0.12)';
  overlay.style.borderRadius = '10px';
  overlay.style.boxShadow =
    '0 0 0 1px rgba(255,255,255,0.45), 0 14px 40px rgba(15, 118, 110, 0.18)';
  overlay.style.transition = 'opacity 120ms ease';
  overlay.style.opacity = '0';
  document.documentElement.append(overlay);

  const selectionStyle = document.createElement('style');
  selectionStyle.textContent = `
    [data-md-extractor-selected="true"] {
      background: rgba(253, 224, 71, 0.28) !important;
      outline: 2px solid rgba(202, 138, 4, 0.95) !important;
      outline-offset: 2px !important;
      transition: background 120ms ease, outline-color 120ms ease;
    }

    img[data-md-extractor-selected="true"],
    table[data-md-extractor-selected="true"] {
      box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.9) !important;
    }
  `;
  (document.head ?? document.documentElement).append(selectionStyle);

  let isActive = false;
  const selectionTargets = new Map<string, Element>();

  function clearPersistentHighlights(): void {
    document.querySelectorAll('[data-md-extractor-selected="true"]').forEach((element) => {
      element.removeAttribute('data-md-extractor-selected');
      element.removeAttribute('data-md-extractor-selection-key');
    });
  }

  function syncPersistentHighlights(
    highlights: Array<{ selectionKey: string; selectorHint: string }>,
  ): void {
    clearPersistentHighlights();
    const nextKeys = new Set(highlights.map((highlight) => highlight.selectionKey));

    highlights.forEach((highlight) => {
      const rememberedElement = selectionTargets.get(highlight.selectionKey);
      if (rememberedElement != null) {
        rememberedElement.setAttribute('data-md-extractor-selected', 'true');
        rememberedElement.setAttribute('data-md-extractor-selection-key', highlight.selectionKey);
        return;
      }

      try {
        const element = document.querySelector(highlight.selectorHint);
        if (!(element instanceof Element)) {
          return;
        }

        element.setAttribute('data-md-extractor-selected', 'true');
        element.setAttribute('data-md-extractor-selection-key', highlight.selectionKey);
        selectionTargets.set(highlight.selectionKey, element);
      } catch {
        // Ignore invalid selector hints and keep the rest of the highlight set.
      }
    });

    Array.from(selectionTargets.keys()).forEach((selectionKey) => {
      if (!nextKeys.has(selectionKey)) {
        selectionTargets.delete(selectionKey);
      }
    });
  }

  function rememberSelectionTarget(selectionKey: string | undefined, element: Element): void {
    if (selectionKey == null) {
      return;
    }

    selectionTargets.set(selectionKey, element);
  }

  async function syncPageContext(): Promise<void> {
    await chrome.runtime.sendMessage({
      type: 'SYNC_PAGE_CONTEXT',
      pageContext: createPageContext(),
    });
  }

  async function pushSelection(selection: SelectionCapturePayload): Promise<void> {
    await chrome.runtime.sendMessage({
      type: 'ADD_SELECTION_FROM_PAGE',
      selection,
      pageContext: createPageContext(),
    });
  }

  async function toggleSelection(selection: SelectionCapturePayload): Promise<void> {
    await chrome.runtime.sendMessage({
      type: 'TOGGLE_SELECTION_FROM_PAGE',
      selection,
      pageContext: createPageContext(),
    });
  }

  async function captureClickedElement(target: Element): Promise<void> {
    if (target instanceof HTMLImageElement) {
      const selectionKey = buildSelectionKey('image', target);
      rememberSelectionTarget(selectionKey, target);
      await toggleSelection({
        kind: 'image',
        format: 'image',
        selectionKey,
        text: normalizeOptionalText(target.alt) ?? 'Imagen capturada',
        imageUrl: target.currentSrc || target.src,
        selectorHint: buildSelectorHint(target),
      });
      return;
    }

    const heading = headingElement(target);
    if (heading != null) {
      const text = extractVisibleText(heading);
      if (text.length === 0) {
        return;
      }

      const selectionKey = buildSelectionKey('heading', heading);
      rememberSelectionTarget(selectionKey, heading);
      await toggleSelection({
        kind: 'element',
        format: 'heading',
        selectionKey,
        text,
        headingLevel: headingLevel(heading),
        htmlSnippet: buildHtmlSnippet(heading),
        selectorHint: buildSelectorHint(heading),
      });
      return;
    }

    const table = extractTableData(target);
    if (table != null) {
      const tableElement = target.closest('table') ?? target;
      const selectionKey = buildSelectionKey('table', tableElement);
      rememberSelectionTarget(selectionKey, tableElement);
      await toggleSelection({
        kind: 'element',
        format: 'table',
        selectionKey,
        text: table.rows.map((row) => row.join(' | ')).join(' / '),
        table,
        htmlSnippet: buildHtmlSnippet(tableElement),
        selectorHint: buildSelectorHint(tableElement),
      });
      return;
    }

    const list = extractListData(target);
    if (list != null) {
      const listElement = target.closest('ul, ol') ?? target;
      const selectionKey = buildSelectionKey('list', listElement);
      rememberSelectionTarget(selectionKey, listElement);
      await toggleSelection({
        kind: 'element',
        format: 'list',
        selectionKey,
        text: list.items.join(' · '),
        listItems: list.items,
        orderedList: list.ordered,
        htmlSnippet: buildHtmlSnippet(listElement),
        selectorHint: buildSelectorHint(listElement),
      });
      return;
    }

    const element = findSemanticContainer(target);
    const selectorHint = buildSelectorHint(element);
    const inferredList = inferListFromText(extractStructuredText(element));
    if (inferredList != null) {
      const selectionKey = buildSelectionKey('list', element);
      rememberSelectionTarget(selectionKey, element);
      await toggleSelection({
        kind: 'element',
        format: 'list',
        selectionKey,
        text: inferredList.items.join(' · '),
        listItems: inferredList.items,
        orderedList: inferredList.ordered,
        htmlSnippet: buildHtmlSnippet(element),
        selectorHint,
      });
      return;
    }

    const text = extractVisibleText(element);
    if (text.length === 0) {
      return;
    }

    const selectionKey = buildSelectionKey('paragraph', element);
    rememberSelectionTarget(selectionKey, element);
    await toggleSelection({
      kind: 'element',
      format: 'paragraph',
      selectionKey,
      text,
      htmlSnippet: buildHtmlSnippet(element),
      selectorHint,
    });
  }

  async function captureTextSelection(): Promise<void> {
    const selection = window.getSelection();
    const rawText = selection?.toString();
    if (rawText == null) {
      return;
    }

    const anchor =
      selection?.anchorNode instanceof Element
        ? selection.anchorNode
        : (selection?.anchorNode?.parentElement ?? null);

    const inferredList = inferListFromText(rawText);
    if (inferredList != null) {
      await pushSelection({
        kind: 'textRange',
        format: 'list',
        text: inferredList.items.join(' · '),
        listItems: inferredList.items,
        orderedList: inferredList.ordered,
        selectorHint: anchor == null ? undefined : buildSelectorHint(anchor),
      });
      return;
    }

    const text = normalizeOptionalText(rawText);
    if (text == null) {
      return;
    }

    await pushSelection({
      kind: 'textRange',
      format: 'paragraph',
      text,
      selectorHint: anchor == null ? undefined : buildSelectorHint(anchor),
    });
  }

  function updateOverlay(element: Element | null): void {
    if (!isActive || element == null) {
      overlay.style.opacity = '0';
      return;
    }

    const rect = element.getBoundingClientRect();
    overlay.style.opacity = '1';
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  function onMouseMove(event: MouseEvent): void {
    if (!isActive) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element) || target === overlay || overlay.contains(target)) {
      updateOverlay(null);
      return;
    }

    updateOverlay(findSemanticContainer(target));
  }

  function onClick(event: MouseEvent): void {
    if (!isActive) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (overlay.contains(target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void captureClickedElement(target);
  }

  function onMouseUp(): void {
    if (!isActive) {
      return;
    }

    void captureTextSelection();
  }

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('mouseup', onMouseUp, true);

  const runtime: PickerRuntime = {
    active: false,
    overlay,
    activate() {
      isActive = true;
      runtime.active = true;
      overlay.style.opacity = '0';
      document.documentElement.style.cursor = 'crosshair';
      void syncPageContext();
    },
    deactivate() {
      isActive = false;
      runtime.active = false;
      overlay.style.opacity = '0';
      document.documentElement.style.removeProperty('cursor');
      window.getSelection()?.removeAllRanges();
    },
    syncHighlights(nextHighlights) {
      syncPersistentHighlights(nextHighlights);
    },
  };

  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (typeof message !== 'object' || message == null || !('type' in message)) {
      return;
    }

    if (message.type === 'PICKER_CONTROL') {
      const mode = 'mode' in message ? message.mode : undefined;
      if (mode === 'activate') {
        runtime.activate();
      }
      if (mode === 'deactivate') {
        runtime.deactivate();
      }
      return;
    }

    if (message.type === 'PICKER_SELECTIONS_SYNC') {
      const highlights =
        'highlights' in message && Array.isArray(message.highlights) ? message.highlights : [];
      syncPersistentHighlights(
        highlights.filter(
          (highlight): highlight is { selectionKey: string; selectorHint: string } =>
            typeof highlight === 'object' &&
            highlight != null &&
            'selectionKey' in highlight &&
            'selectorHint' in highlight &&
            typeof highlight.selectionKey === 'string' &&
            typeof highlight.selectorHint === 'string',
        ),
      );
    }
  });

  runtimeHost[globalKey] = runtime;
  runtime.activate();
  return undefined;
}
