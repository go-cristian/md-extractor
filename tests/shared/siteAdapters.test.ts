import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { extractPageMetadata } from '@/shared/siteAdapters';

function loadFixture(name: string, url: string): Document {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures', name), 'utf8');
  const document = documentImplementation.createHTMLDocument(url);
  document.documentElement.innerHTML = html;
  return document;
}

const documentImplementation = document.implementation;

describe('siteAdapters', () => {
  it('detecta metadata de Amazon desde el DOM', () => {
    const document = loadFixture('amazon-product.html', 'http://127.0.0.1:4173/amazon.html');
    const result = extractPageMetadata(document, new URL('http://127.0.0.1:4173/amazon.html'));

    expect(result.siteName).toBe('amazon');
    expect(result.metadata.title).toBe('Sony WH-1000XM5 Wireless Headphones');
    expect(result.metadata.price).toBe('$399.99');
    expect(result.metadata.rating).toContain('4.7');
  });

  it('detecta metadata de Shopify desde señales del documento', () => {
    const document = loadFixture('shopify-product.html', 'http://127.0.0.1:4173/shopify.html');
    const result = extractPageMetadata(document, new URL('http://127.0.0.1:4173/shopify.html'));

    expect(result.siteName).toBe('shopify');
    expect(result.metadata.title).toBe('North Studio Canvas Tote');
    expect(result.metadata.price).toBe('$48.00');
    expect(result.metadata.seller).toBe('North Studio');
  });
});
