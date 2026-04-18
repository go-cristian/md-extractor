export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeOptionalText(value: string | null | undefined): string | undefined {
  if (value == null) {
    return undefined;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : undefined;
}

export function compactHtmlSnippet(value: string | undefined, maxLength = 240): string | undefined {
  if (value == null || value.length === 0) {
    return undefined;
  }

  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function normalizeLineText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function inferListFromText(
  value: string,
): { items: string[]; ordered: boolean } | undefined {
  const lines = value.split(/\r?\n/).map(normalizeLineText).filter(Boolean);
  if (lines.length < 2) {
    return undefined;
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
    const isSequential = numbers.every((value, index) => {
      if (index === 0) {
        return true;
      }

      const previous = numbers[index - 1];
      return previous != null && value === previous + 1;
    });
    if (!isSequential) {
      return undefined;
    }

    return {
      items: orderedMatches.map((match) => normalizeText(match[2] ?? '')),
      ordered: true,
    };
  }

  return undefined;
}

function removeNoisyDescendants(root: Element): void {
  root
    .querySelectorAll(
      'script, style, noscript, template, svg, iframe, canvas, link, meta, [hidden], [aria-hidden="true"]',
    )
    .forEach((node) => {
      node.remove();
    });
}

export function extractVisibleTextFromElement(element: Element): string {
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
