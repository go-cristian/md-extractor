import { extractVisibleTextFromElement, normalizeOptionalText } from '@/shared/selectionUtils';
import type { PageMetadata, SiteAdapter } from '@/shared/types';

function readMetaContent(document: Document, selector: string): string | undefined {
  const element = document.querySelector<HTMLMetaElement>(selector);
  return normalizeOptionalText(element?.content);
}

function readText(document: Document, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    const text =
      element == null ? undefined : normalizeOptionalText(extractVisibleTextFromElement(element));

    if (text != null) {
      return text;
    }
  }

  return undefined;
}

function readAttribute(
  document: Document,
  selectors: string[],
  attribute: string,
): string | undefined {
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    const value = normalizeOptionalText(element?.getAttribute(attribute));

    if (value != null) {
      return value;
    }
  }

  return undefined;
}

export const amazonAdapter: SiteAdapter = {
  id: 'amazon',
  matches(url, document) {
    return (
      /(^|\.)amazon\./i.test(url.hostname) ||
      document.querySelector('#productTitle') != null ||
      document.querySelector('#acrPopover') != null
    );
  },
  extractMetadata(document) {
    return {
      title:
        readText(document, ['#productTitle', '[data-automation-id="product-title"]']) ??
        readMetaContent(document, 'meta[property="og:title"]') ??
        document.title,
      price: readText(document, [
        '.a-price .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-offscreen',
      ]),
      seller: readText(document, ['#sellerProfileTriggerId', '#bylineInfo']),
      rating: readText(document, [
        '#acrPopover [aria-hidden="true"]',
        '[data-hook="rating-out-of-text"]',
      ]),
      availability: readText(document, ['#availability span', '#outOfStock span']),
      heroImageUrl: readAttribute(document, ['#landingImage', '#imgTagWrapperId img'], 'src'),
    } satisfies Partial<PageMetadata>;
  },
};

export const shopifyAdapter: SiteAdapter = {
  id: 'shopify',
  matches(url, document) {
    return (
      /myshopify\.com$/i.test(url.hostname) ||
      document.querySelector('meta[name="shopify-digital-wallet"]') != null ||
      document.documentElement.innerHTML.includes('Shopify.theme')
    );
  },
  extractMetadata(document) {
    return {
      title:
        readText(document, [
          '[data-product-title]',
          '.product__title',
          '.product-single__title',
          'h1',
        ]) ??
        readMetaContent(document, 'meta[property="og:title"]') ??
        document.title,
      price: readText(document, [
        '[data-product-price]',
        '.price-item--regular',
        '.product__price',
        '.price',
      ]),
      seller: readMetaContent(document, 'meta[property="product:brand"]'),
      availability:
        readText(document, [
          '[data-product-inventory-status]',
          '.product-form__inventory',
          '[data-inventory-status]',
        ]) ?? readMetaContent(document, 'meta[property="product:availability"]'),
      heroImageUrl:
        readMetaContent(document, 'meta[property="og:image"]') ??
        readAttribute(document, ['.product__media img', '.product-featured-media img'], 'src'),
    } satisfies Partial<PageMetadata>;
  },
};

const adapters = [amazonAdapter, shopifyAdapter];

function genericMetadata(document: Document): Partial<PageMetadata> {
  return {
    title:
      readMetaContent(document, 'meta[property="og:title"]') ??
      readText(document, ['h1']) ??
      document.title,
    price:
      readMetaContent(document, 'meta[property="product:price:amount"]') ??
      readText(document, ['[itemprop="price"]', '.price', '[data-price]']),
    currency: readMetaContent(document, 'meta[property="product:price:currency"]'),
    seller: readMetaContent(document, 'meta[property="product:brand"]'),
    availability: readMetaContent(document, 'meta[property="product:availability"]'),
    heroImageUrl: readMetaContent(document, 'meta[property="og:image"]'),
  } satisfies Partial<PageMetadata>;
}

export function detectSiteName(url: URL): string {
  return url.hostname.replace(/^www\./i, '');
}

export function extractPageMetadata(
  document: Document,
  url: URL,
): {
  metadata: Partial<PageMetadata>;
  siteName: string;
} {
  const adapter = adapters.find((candidate) => candidate.matches(url, document));
  const metadata = {
    ...genericMetadata(document),
    ...adapter?.extractMetadata(document),
  } satisfies Partial<PageMetadata>;

  return {
    metadata,
    siteName: adapter?.id ?? detectSiteName(url),
  };
}
