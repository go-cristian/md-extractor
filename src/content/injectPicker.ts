import type {
  ExtractionBlockConfig,
  PageContextPayload,
  PrimaryCapturePayload,
  RevealStep,
  SelectionCapturePayload,
  SelectionTable,
  SiteExtractionProfile,
} from '@/shared/types';

export function runPickerAction(
  action: 'activate' | 'deactivate' | 'captureDocument' | 'capturePrimary' | 'syncHighlights',
  highlights: Array<{ selectionKey: string; selectorHint: string }> = [],
  profiles: SiteExtractionProfile[] = [],
): PrimaryCapturePayload | undefined {
  interface PickerRuntime {
    active: boolean;
    overlay: HTMLDivElement;
    activate(): void;
    deactivate(): void;
    syncHighlights(highlights: Array<{ selectionKey: string; selectorHint: string }>): void;
  }

  const NOISY_SELECTOR =
    'script, style, noscript, template, svg, iframe, canvas, link, meta, [hidden], [aria-hidden="true"]';
  const BLOCK_CONTAINER_TAGS = new Set([
    'ARTICLE',
    'ASIDE',
    'BLOCKQUOTE',
    'DD',
    'DIV',
    'FIGCAPTION',
    'HEADER',
    'LI',
    'MAIN',
    'NAV',
    'SECTION',
    'TD',
  ]);
  const PRIMARY_PARAGRAPH_MAX = 700;

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

  function compactHtmlSnippet(value: string): string | undefined {
    const maxLength = 240;
    return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
  }

  function hasMeaningfulContent(element: Element): boolean {
    if (element instanceof HTMLImageElement) {
      return (element.currentSrc || element.src).length > 0;
    }

    return extractVisibleText(element).length > 0;
  }

  function getVisibleChildren(element: Element): Element[] {
    return Array.from(element.children).filter(
      (child) => !isHiddenElement(child) && !child.matches(NOISY_SELECTOR),
    );
  }

  function hasDirectText(element: Element): boolean {
    return Array.from(element.childNodes).some((node) => {
      if (node.nodeType !== Node.TEXT_NODE) {
        return false;
      }

      return normalizeOptionalText(node.textContent)?.length !== 0;
    });
  }

  function buildOrderKey(element: Element): string {
    const segments: string[] = [];
    let current: Element | null = element;

    while (current != null && current !== document.documentElement) {
      const currentParent: Element | null = current.parentElement;
      if (currentParent == null) {
        break;
      }

      const siblings = Array.from(currentParent.children);
      const index = siblings.indexOf(current);
      segments.unshift(String(Math.max(0, index)).padStart(4, '0'));
      current = currentParent;
    }

    return segments.join('.');
  }

  function shouldCaptureParagraphLike(element: Element): boolean {
    if (element.matches('html, body')) {
      return false;
    }

    if (element.matches('script, style, noscript, template')) {
      return false;
    }

    if (element instanceof HTMLImageElement) {
      return false;
    }

    if (isHeadingNode(element) || element.matches('p, table, ul, ol')) {
      return false;
    }

    if (!hasMeaningfulContent(element)) {
      return false;
    }

    if (hasDirectText(element)) {
      return true;
    }

    const children = getVisibleChildren(element);
    if (children.length === 0) {
      return true;
    }

    return (
      BLOCK_CONTAINER_TAGS.has(element.tagName) ||
      children.every((child) => child.matches('span, a, strong, em, b, i, small'))
    );
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
  ): boolean {
    const normalizedText = normalizeOptionalText(selection.text) ?? '';
    const normalizedListItems =
      selection.listItems?.map((item) => normalizeText(item)) ?? undefined;
    const signature = `${selection.format}:${normalizedText}:${selection.imageUrl ?? ''}`;

    if (
      (selection.format !== 'image' && normalizedText.length === 0) ||
      (selection.format === 'image' && normalizedText.length === 0 && selection.imageUrl == null) ||
      seen.has(signature)
    ) {
      return false;
    }

    seen.add(signature);
    selections.push({
      ...selection,
      text: normalizedText,
      listItems: normalizedListItems,
    });
    return true;
  }

  function appendParagraphSelection(
    element: Element,
    selections: SelectionCapturePayload[],
    seen: Set<string>,
  ): boolean {
    const structuredText = extractStructuredText(element);
    const inferredList = inferListFromText(structuredText);
    if (inferredList != null) {
      return appendUniqueSelection(selections, seen, {
        kind: 'element',
        format: 'list',
        orderKey: buildOrderKey(element),
        selectionKey: buildSelectionKey('list', element),
        text: inferredList.items.join(' · '),
        listItems: inferredList.items,
        orderedList: inferredList.ordered,
        htmlSnippet: buildHtmlSnippet(element),
        selectorHint: buildSelectorHint(element),
      });
    }

    const paragraph = splitParagraphsFromElement(element).join('\n\n');
    return appendUniqueSelection(selections, seen, {
      kind: 'element',
      format: 'paragraph',
      orderKey: buildOrderKey(element),
      selectionKey: buildSelectionKey('paragraph', element),
      text: paragraph,
      htmlSnippet: buildHtmlSnippet(element),
      selectorHint: buildSelectorHint(element),
    });
  }

  function collectDocumentSelections(root: Element): SelectionCapturePayload[] {
    const selections: SelectionCapturePayload[] = [];
    const seen = new Set<string>();

    function visit(element: Element): boolean {
      if (isHiddenElement(element) || element.matches(NOISY_SELECTOR)) {
        return false;
      }

      if (isHeadingNode(element)) {
        return appendUniqueSelection(selections, seen, {
          kind: 'element',
          format: 'heading',
          orderKey: buildOrderKey(element),
          selectionKey: buildSelectionKey('heading', element),
          text: extractVisibleText(element),
          headingLevel: headingLevel(element),
          htmlSnippet: buildHtmlSnippet(element),
          selectorHint: buildSelectorHint(element),
        });
      }

      if (element.matches('table')) {
        const table = extractTableData(element);
        if (table != null) {
          return appendUniqueSelection(selections, seen, {
            kind: 'element',
            format: 'table',
            orderKey: buildOrderKey(element),
            selectionKey: buildSelectionKey('table', element),
            text: table.rows.map((row) => row.join(' | ')).join(' / '),
            table,
            htmlSnippet: buildHtmlSnippet(element),
            selectorHint: buildSelectorHint(element),
          });
        }
        return false;
      }

      if (element.matches('ul, ol')) {
        const list = extractListData(element);
        if (list != null) {
          return appendUniqueSelection(selections, seen, {
            kind: 'element',
            format: 'list',
            orderKey: buildOrderKey(element),
            selectionKey: buildSelectionKey('list', element),
            text: list.items.join(' · '),
            listItems: list.items,
            orderedList: list.ordered,
            htmlSnippet: buildHtmlSnippet(element),
            selectorHint: buildSelectorHint(element),
          });
        }
        return false;
      }

      if (element instanceof HTMLImageElement) {
        return appendUniqueSelection(selections, seen, {
          kind: 'image',
          format: 'image',
          orderKey: buildOrderKey(element),
          selectionKey: buildSelectionKey('image', element),
          text: normalizeOptionalText(element.alt) ?? 'Imagen capturada',
          imageUrl: element.currentSrc || element.src,
          selectorHint: buildSelectorHint(element),
        });
      }

      if (element.matches('p')) {
        return appendParagraphSelection(element, selections, seen);
      }

      let capturedDescendant = false;
      getVisibleChildren(element).forEach((child) => {
        if (visit(child)) {
          capturedDescendant = true;
        }
      });

      if (capturedDescendant) {
        return true;
      }

      if (!shouldCaptureParagraphLike(element)) {
        return false;
      }

      return appendParagraphSelection(element, selections, seen);
    }

    visit(root);
    return selections;
  }

  function resolveSelectionElement(initial: Element): Element {
    if (
      (isHiddenElement(initial) || initial.matches(NOISY_SELECTOR)) &&
      initial.parentElement != null
    ) {
      return resolveSelectionElement(initial.parentElement);
    }

    const heading = headingElement(initial);
    if (heading != null) {
      return heading;
    }

    const table = initial.closest('table');
    if (table != null) {
      return table;
    }

    const list = initial.closest('ul, ol');
    if (list != null) {
      return list;
    }

    const paragraph = initial.closest('p');
    if (paragraph != null) {
      return paragraph;
    }

    if (initial instanceof HTMLImageElement) {
      return initial;
    }

    let current: Element | null = initial;
    while (current != null && current !== document.body && current !== document.documentElement) {
      if (shouldCaptureParagraphLike(current)) {
        return current;
      }

      current = current.parentElement;
    }

    return initial;
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

  function detectSiteName(): string {
    const hostname = window.location.hostname;
    if (
      /(^|\.)amazon\./i.test(hostname) ||
      document.querySelector('#productTitle') != null ||
      document.querySelector('#dp-container') != null
    ) {
      return 'amazon';
    }

    if (
      /myshopify\.com$/i.test(hostname) ||
      document.querySelector('meta[name="shopify-digital-wallet"]') != null ||
      document.documentElement.innerHTML.includes('Shopify.theme')
    ) {
      return 'shopify';
    }

    return hostname.replace(/^www\./i, '');
  }

  function extractMetadata(): PageContextPayload['metadata'] {
    const metadata: PageContextPayload['metadata'] = {};
    const baseTitle = readMeta('meta[property="og:title"]') ?? readText(['h1']) ?? document.title;
    metadata.title = baseTitle;
    metadata.price =
      readMeta('meta[property="product:price:amount"]') ??
      readText(['[itemprop="price"]', '.price', '[data-price]']);
    metadata.currency = readMeta('meta[property="product:price:currency"]');
    metadata.seller = readMeta('meta[property="product:brand"]');
    metadata.availability = readMeta('meta[property="product:availability"]');
    metadata.heroImageUrl = readMeta('meta[property="og:image"]');

    if (detectSiteName() === 'amazon') {
      return {
        ...metadata,
        title: readText(['#productTitle', '[data-automation-id="product-title"]']) ?? baseTitle,
        price: readText([
          '#corePriceDisplay_desktop_feature_div .a-offscreen',
          '.a-price .a-offscreen',
        ]),
        seller: readText(['#sellerProfileTriggerId', '#bylineInfo']),
        rating: readText(['#acrPopover [aria-hidden="true"]', '[data-hook="rating-out-of-text"]']),
        availability: readText(['#availability span', '#outOfStock span']),
        heroImageUrl: readAttribute(['#landingImage', '#imgTagWrapperId img'], 'src'),
      };
    }

    if (detectSiteName() === 'shopify') {
      return {
        ...metadata,
        title:
          readText(['[data-product-title]', '.product__title', '.product-single__title', 'h1']) ??
          baseTitle,
        price: readText([
          '[data-product-price]',
          '.price-item--regular',
          '.product__price',
          '.price',
        ]),
        seller: readMeta('meta[property="product:brand"]'),
        availability:
          readText([
            '[data-product-inventory-status]',
            '.product-form__inventory',
            '[data-inventory-status]',
          ]) ?? metadata.availability,
        heroImageUrl:
          readMeta('meta[property="og:image"]') ??
          readAttribute(['.product__media img', '.product-featured-media img'], 'src'),
      };
    }

    return metadata;
  }

  function matchesProfile(profile: SiteExtractionProfile): boolean {
    const hostnameMatch =
      profile.hostnames?.some(
        (hostname) =>
          window.location.hostname === hostname ||
          window.location.hostname.endsWith(`.${hostname}`),
      ) ?? false;
    const signalMatch =
      profile.signals?.some((selector) => document.querySelector(selector) != null) ?? false;

    return hostnameMatch || signalMatch;
  }

  function anchorElement(profile: SiteExtractionProfile): Element | null {
    for (const selector of profile.anchorSelectors ?? []) {
      const element = document.querySelector(selector);
      if (element != null) {
        return element;
      }
    }

    return null;
  }

  function resolveRevealTrigger(step: RevealStep): HTMLElement | null {
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
      candidates.find((candidate) => normalizeText(candidate.textContent ?? '') === step.text) ??
      null
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

  function runRevealStep(step: RevealStep): boolean {
    const trigger = resolveRevealTrigger(step);
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
    const firstVoyagerIndex = selections.findIndex((selection) =>
      isAmazonMergeCandidate(selection),
    );
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

  function selectionFromBlock(
    block: ExtractionBlockConfig,
    element: Element,
  ): SelectionCapturePayload | null {
    switch (block.type) {
      case 'heading': {
        const text = normalizeOptionalText(extractVisibleText(element));
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
        const text = normalizeOptionalText(extractVisibleText(element));
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
      case 'list': {
        const list = extractListData(element);
        if (list == null) {
          return null;
        }

        return {
          kind: 'element',
          format: 'list',
          orderKey: buildOrderKey(element),
          selectionKey: buildSelectionKey('list', element),
          text: list.items.join(' · '),
          listItems: list.items,
          orderedList: list.ordered,
          htmlSnippet: buildHtmlSnippet(element),
          selectorHint: buildSelectorHint(element),
        };
      }
      case 'table': {
        const table = extractTableData(element);
        if (table == null) {
          return null;
        }

        return {
          kind: 'element',
          format: 'table',
          orderKey: buildOrderKey(element),
          selectionKey: buildSelectionKey('table', element),
          text: table.rows.map((row) => row.join(' | ')).join(' / '),
          table,
          htmlSnippet: buildHtmlSnippet(element),
          selectorHint: buildSelectorHint(element),
        };
      }
      case 'image': {
        if (!(element instanceof HTMLImageElement)) {
          return null;
        }

        return {
          kind: 'image',
          format: 'image',
          orderKey: buildOrderKey(element),
          selectionKey: buildSelectionKey('image', element),
          text: normalizeOptionalText(element.alt) ?? 'Imagen capturada',
          imageUrl: element.currentSrc || element.src,
          selectorHint: buildSelectorHint(element),
        };
      }
    }
  }

  function extractWithProfiles(): SelectionCapturePayload[] | null {
    const profile = profiles.find((candidate) => matchesProfile(candidate));
    if (profile == null) {
      return null;
    }

    profile.reveal?.forEach((step) => {
      runRevealStep(step);
    });

    const selections: SelectionCapturePayload[] = [];
    const seen = new Set<string>();

    profile.blocks.forEach((block) => {
      block.selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
          const selection = selectionFromBlock(block, element);
          if (selection == null) {
            return;
          }

          appendUniqueSelection(selections, seen, selection);
        });
      });
    });

    if (selections.length === 0) {
      return null;
    }
    const anchor = anchorElement(profile);
    if (anchor == null) {
      const sortedSelections = selections.sort((left, right) =>
        (left.orderKey ?? '').localeCompare(right.orderKey ?? ''),
      );

      return profile.id === 'amazon'
        ? normalizeAmazonSelections(sortedSelections, null)
        : sortedSelections;
    }

    const anchorOrderKey = buildOrderKey(anchor);
    const anchorText = normalizeOptionalText(extractVisibleText(anchor));
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

    return profile.id === 'amazon'
      ? normalizeAmazonSelections(orderedSelections, comparableAnchorText)
      : orderedSelections;
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

  function captureDocumentContent(): PrimaryCapturePayload {
    const pageContext = createPageContext();
    const selections =
      extractWithProfiles() ??
      (document.body == null ? [] : collectDocumentSelections(document.body));

    return {
      pageContext,
      selections,
    };
  }

  if (action === 'captureDocument' || action === 'capturePrimary') {
    return captureDocumentContent();
  }

  const globalKey = '__MD_EXTRACTOR_PICKER__';
  const runtimeHost = globalThis as typeof globalThis & {
    [globalKey]?: PickerRuntime;
  };

  if (runtimeHost[globalKey] != null) {
    if (action === 'activate') {
      runtimeHost[globalKey]?.activate();
      if (highlights.length > 0) {
        runtimeHost[globalKey]?.syncHighlights(highlights);
      }
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

  async function toggleSelection(selection: SelectionCapturePayload): Promise<void> {
    await chrome.runtime.sendMessage({
      type: 'TOGGLE_SELECTION_FROM_PAGE',
      selection,
      pageContext: createPageContext(),
    });
  }

  function buildSelectionFromElement(element: Element): SelectionCapturePayload | null {
    const orderKey = buildOrderKey(element);

    if (element instanceof HTMLImageElement) {
      return {
        kind: 'image',
        format: 'image',
        orderKey,
        selectionKey: buildSelectionKey('image', element),
        text: normalizeOptionalText(element.alt) ?? 'Imagen capturada',
        imageUrl: element.currentSrc || element.src,
        selectorHint: buildSelectorHint(element),
      };
    }

    if (isHeadingNode(element)) {
      const text = extractVisibleText(element);
      if (text.length === 0) {
        return null;
      }

      return {
        kind: 'element',
        format: 'heading',
        orderKey,
        selectionKey: buildSelectionKey('heading', element),
        text,
        headingLevel: headingLevel(element),
        htmlSnippet: buildHtmlSnippet(element),
        selectorHint: buildSelectorHint(element),
      };
    }

    const table = extractTableData(element);
    if (table != null && element.matches('table')) {
      return {
        kind: 'element',
        format: 'table',
        orderKey,
        selectionKey: buildSelectionKey('table', element),
        text: table.rows.map((row) => row.join(' | ')).join(' / '),
        table,
        htmlSnippet: buildHtmlSnippet(element),
        selectorHint: buildSelectorHint(element),
      };
    }

    const list = extractListData(element);
    if (list != null && element.matches('ul, ol')) {
      return {
        kind: 'element',
        format: 'list',
        orderKey,
        selectionKey: buildSelectionKey('list', element),
        text: list.items.join(' · '),
        listItems: list.items,
        orderedList: list.ordered,
        htmlSnippet: buildHtmlSnippet(element),
        selectorHint: buildSelectorHint(element),
      };
    }

    if (!shouldCaptureParagraphLike(element) && !element.matches('p')) {
      return null;
    }

    const inferredList = inferListFromText(extractStructuredText(element));
    if (inferredList != null) {
      return {
        kind: 'element',
        format: 'list',
        orderKey,
        selectionKey: buildSelectionKey('list', element),
        text: inferredList.items.join(' · '),
        listItems: inferredList.items,
        orderedList: inferredList.ordered,
        htmlSnippet: buildHtmlSnippet(element),
        selectorHint: buildSelectorHint(element),
      };
    }

    const text = splitParagraphsFromElement(element).join('\n\n');
    if (text.length === 0) {
      return null;
    }

    return {
      kind: 'element',
      format: 'paragraph',
      orderKey,
      selectionKey: buildSelectionKey('paragraph', element),
      text,
      htmlSnippet: buildHtmlSnippet(element),
      selectorHint: buildSelectorHint(element),
    };
  }

  async function captureClickedElement(target: Element): Promise<void> {
    const element = resolveSelectionElement(target);
    const selection = buildSelectionFromElement(element);
    if (selection == null) {
      return;
    }

    rememberSelectionTarget(selection.selectionKey, element);
    await toggleSelection(selection);
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

    updateOverlay(resolveSelectionElement(target));
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

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);

  const runtime: PickerRuntime = {
    active: false,
    overlay,
    activate() {
      isActive = true;
      runtime.active = true;
      overlay.style.opacity = '0';
      document.documentElement.style.cursor = 'crosshair';
    },
    deactivate() {
      isActive = false;
      runtime.active = false;
      overlay.style.opacity = '0';
      clearPersistentHighlights();
      document.documentElement.style.removeProperty('cursor');
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
  if (highlights.length > 0) {
    runtime.syncHighlights(highlights);
  }
  return undefined;
}
