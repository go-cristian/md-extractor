import { blockKeyFromItem } from '@/shared/draft';
import { buildMarkdownPreviewBlocks, generateMarkdown } from '@/shared/markdown';
import type { DraftDocument, SelectionItem } from '@/shared/types';

function buildDraft(items: SelectionItem[], overrides: Partial<DraftDocument> = {}): DraftDocument {
  const blocksByKey = Object.fromEntries(items.map((item) => [blockKeyFromItem(item), item]));
  return {
    tabId: 2,
    url: 'https://store.example.com/products/nimbus',
    origin: 'https://store.example.com',
    pageTitle: 'Cafetera Nimbus 2L',
    siteName: 'store.example.com',
    includeContext: false,
    metadata: {
      title: 'Cafetera Nimbus 2L',
    },
    blocksByKey,
    orderedKeys: items.map(blockKeyFromItem),
    items,
    updatedAt: '2026-04-17T01:00:00.000Z',
    ...overrides,
  };
}

describe('generateMarkdown', () => {
  it('genera una vista vacia cuando no hay draft', () => {
    expect(generateMarkdown(null)).toContain('Sin contenido');
  });

  it('renderiza solo bloques capturados sin preambulo automatico', () => {
    const draft = buildDraft(
      [
        {
          id: 'img_1',
          tabId: 2,
          url: 'https://store.example.com/products/nimbus',
          kind: 'image',
          format: 'image',
          text: 'Vista principal del producto',
          imageUrl: 'https://images.example.com/nimbus.jpg',
          selectorHint: 'article.product-card > img:nth-of-type(1)',
          selectionKey: 'image:article.product-card > img:nth-of-type(1)',
          createdAt: '2026-04-17T01:00:00.000Z',
        },
      ],
      {
        metadata: {
          title: 'Cafetera Nimbus 2L',
          price: '$89.900',
          availability: 'Disponible',
        },
      },
    );

    const markdown = generateMarkdown(draft);

    expect(markdown).not.toContain('# Cafetera Nimbus 2L');
    expect(markdown).not.toContain('Precio: $89.900');
    expect(markdown).not.toContain('Fuente: https://store.example.com/products/nimbus');
    expect(markdown).toContain('![Imagen 1](https://images.example.com/nimbus.jpg)');
    expect(markdown).not.toContain('Referencia DOM');
  });

  it('renderiza headings y tablas como markdown semantico', () => {
    const draft = buildDraft([
      {
        id: 'heading_1',
        tabId: 3,
        url: 'https://store.example.com/products/nimbus',
        kind: 'element',
        format: 'heading',
        text: 'Especificaciones',
        headingLevel: 2,
        selectorHint: 'section#specs > h2',
        selectionKey: 'heading:section#specs > h2',
        createdAt: '2026-04-17T01:00:00.000Z',
      },
      {
        id: 'table_1',
        tabId: 3,
        url: 'https://store.example.com/products/nimbus',
        kind: 'element',
        format: 'table',
        text: 'Marca | Nimbus / Capacidad | 2L',
        selectionKey: 'table:section#specs > table',
        table: {
          headers: ['Campo', 'Valor'],
          rows: [
            ['Marca', 'Nimbus'],
            ['Capacidad', '2L'],
          ],
        },
        createdAt: '2026-04-17T01:01:00.000Z',
      },
    ]);

    const markdown = generateMarkdown(draft);

    expect(markdown).toContain('## Especificaciones');
    expect(markdown).toContain('| Campo | Valor |');
    expect(markdown).not.toContain('## Seleccion 1');
    expect(markdown).not.toContain('Fuente:');
  });

  it('preserva el titulo principal como heading capturado', () => {
    const draft = buildDraft([
      {
        id: 'heading_1',
        tabId: 3,
        url: 'https://store.example.com/products/nimbus',
        kind: 'element',
        format: 'heading',
        text: 'Cafetera Nimbus 2L',
        headingLevel: 1,
        selectorHint: 'article.product-card > h1',
        selectionKey: 'heading:article.product-card > h1',
        createdAt: '2026-04-17T01:00:00.000Z',
      },
    ]);

    const markdown = generateMarkdown(draft);

    expect(markdown).toContain('# Cafetera Nimbus 2L');
    expect(markdown).not.toContain('Referencia DOM');
  });

  it('renderiza listas markdown semanticas', () => {
    const draft = buildDraft([
      {
        id: 'list_1',
        tabId: 4,
        url: 'https://store.example.com/products/nimbus',
        kind: 'element',
        format: 'list',
        text: 'Apoya la digestion · Mejora la regularidad · Reduce la hinchazon',
        selectionKey: 'list:section#benefits > ul',
        listItems: ['Apoya la digestion', 'Mejora la regularidad', 'Reduce la hinchazon'],
        orderedList: false,
        createdAt: '2026-04-17T01:00:00.000Z',
      },
      {
        id: 'list_2',
        tabId: 4,
        url: 'https://store.example.com/products/nimbus',
        kind: 'textRange',
        format: 'list',
        text: 'Primer paso · Segundo paso',
        listItems: ['Primer paso', 'Segundo paso'],
        orderedList: true,
        createdAt: '2026-04-17T01:01:00.000Z',
      },
    ]);

    const markdown = generateMarkdown(draft);

    expect(markdown).toContain('- Apoya la digestion');
    expect(markdown).toContain('- Mejora la regularidad');
    expect(markdown).toContain('1. Primer paso');
    expect(markdown).toContain('2. Segundo paso');
    expect(markdown).not.toContain('# Cafetera Nimbus 2L');
  });

  it('derive el orden desde orderedKeys aunque items esté desfasado', () => {
    const heading: SelectionItem = {
      id: 'heading_1',
      tabId: 3,
      url: 'https://store.example.com/products/nimbus',
      kind: 'element',
      format: 'heading',
      text: 'Cafetera Nimbus 2L',
      headingLevel: 1,
      selectorHint: 'article.product-card > h1',
      selectionKey: 'heading:article.product-card > h1',
      createdAt: '2026-04-17T01:00:00.000Z',
    };
    const paragraph: SelectionItem = {
      id: 'paragraph_1',
      tabId: 3,
      url: 'https://store.example.com/products/nimbus',
      kind: 'element',
      format: 'paragraph',
      text: 'Cafetera con jarra termica',
      selectorHint: 'article.product-card > p',
      selectionKey: 'paragraph:article.product-card > p',
      createdAt: '2026-04-17T01:01:00.000Z',
    };
    const draft = buildDraft([paragraph, heading], {
      blocksByKey: {
        [blockKeyFromItem(heading)]: heading,
        [blockKeyFromItem(paragraph)]: paragraph,
      },
      orderedKeys: [blockKeyFromItem(heading), blockKeyFromItem(paragraph)],
      items: [paragraph, heading],
    });

    const markdown = generateMarkdown(draft);

    expect(markdown.indexOf('# Cafetera Nimbus 2L')).toBeLessThan(
      markdown.indexOf('Cafetera con jarra termica'),
    );
  });

  it('prepend contexto al inicio cuando el draft lo pide', () => {
    const draft = buildDraft(
      [
        {
          id: 'sel_1',
          tabId: 5,
          url: 'https://store.example.com/products/nimbus',
          kind: 'element',
          format: 'paragraph',
          text: 'Cafetera con jarra termica',
          selectionKey: 'paragraph:article.product-card > p',
          selectorHint: 'article.product-card > p',
          createdAt: '2026-04-17T01:00:00.000Z',
        },
      ],
      {
        tabId: 5,
        includeContext: true,
        metadata: {
          title: 'Cafetera Nimbus 2L',
          price: '$89.900',
          seller: 'Nimbus Home',
          availability: 'Disponible',
        },
      },
    );

    const markdown = generateMarkdown(draft);

    expect(markdown).toMatch(/^## Contexto/);
    expect(markdown).toContain('- Titulo: Cafetera Nimbus 2L');
    expect(markdown).toContain('- Sitio: store.example.com');
    expect(markdown).toContain('- URL: https://store.example.com/products/nimbus');
    expect(markdown).toContain('- Precio: $89.900');
    expect(markdown).toContain('- Vendedor: Nimbus Home');
    expect(markdown).toContain('- Disponibilidad: Disponible');
    expect(markdown).toContain('Cafetera con jarra termica');
  });
});

describe('buildMarkdownPreviewBlocks', () => {
  it('expone bloques ordenados y removibles para cada selección', () => {
    const draft = buildDraft([
      {
        id: 'heading_1',
        tabId: 3,
        url: 'https://store.example.com/products/nimbus',
        kind: 'element',
        format: 'heading',
        text: 'Cafetera Nimbus 2L',
        headingLevel: 1,
        selectorHint: 'article.product-card > h1',
        selectionKey: 'heading:article.product-card > h1',
        createdAt: '2026-04-17T01:00:00.000Z',
      },
      {
        id: 'paragraph_1',
        tabId: 3,
        url: 'https://store.example.com/products/nimbus',
        kind: 'element',
        format: 'paragraph',
        text: 'Cafetera con jarra termica',
        selectorHint: 'article.product-card > p',
        selectionKey: 'paragraph:article.product-card > p',
        createdAt: '2026-04-17T01:01:00.000Z',
      },
    ]);

    const blocks = buildMarkdownPreviewBlocks(draft);

    expect(blocks).toEqual([
      {
        key: 'heading_1',
        itemId: 'heading_1',
        markdown: '# Cafetera Nimbus 2L',
        removable: true,
      },
      {
        key: 'paragraph_1',
        itemId: 'paragraph_1',
        markdown: 'Cafetera con jarra termica',
        removable: true,
      },
    ]);
  });

  it('mantiene el contexto como bloque no removible al inicio', () => {
    const draft = buildDraft(
      [
        {
          id: 'paragraph_1',
          tabId: 5,
          url: 'https://store.example.com/products/nimbus',
          kind: 'element',
          format: 'paragraph',
          text: 'Cafetera con jarra termica',
          selectionKey: 'paragraph:article.product-card > p',
          selectorHint: 'article.product-card > p',
          createdAt: '2026-04-17T01:00:00.000Z',
        },
      ],
      {
        tabId: 5,
        includeContext: true,
        metadata: {
          title: 'Cafetera Nimbus 2L',
        },
      },
    );

    const blocks = buildMarkdownPreviewBlocks(draft);

    expect(blocks[0]).toEqual({
      key: 'context',
      markdown: expect.stringContaining('## Contexto'),
      removable: false,
    });
    expect(blocks[1]).toEqual({
      key: 'paragraph_1',
      itemId: 'paragraph_1',
      markdown: 'Cafetera con jarra termica',
      removable: true,
    });
  });
});
