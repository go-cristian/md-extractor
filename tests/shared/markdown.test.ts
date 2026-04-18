import { generateMarkdown } from '@/shared/markdown';
import type { DraftDocument } from '@/shared/types';

describe('generateMarkdown', () => {
  it('genera una vista vacia cuando no hay draft', () => {
    expect(generateMarkdown(null)).toContain('Sin contenido');
  });

  it('renderiza solo bloques capturados sin preambulo automatico', () => {
    const draft: DraftDocument = {
      tabId: 2,
      url: 'https://store.example.com/products/nimbus',
      origin: 'https://store.example.com',
      pageTitle: 'Cafetera Nimbus 2L',
      siteName: 'store.example.com',
      includeContext: false,
      metadata: {
        title: 'Cafetera Nimbus 2L',
        price: '$89.900',
        availability: 'Disponible',
      },
      updatedAt: '2026-04-17T01:00:00.000Z',
      items: [
        {
          id: 'img_1',
          tabId: 2,
          url: 'https://store.example.com/products/nimbus',
          kind: 'image',
          format: 'image',
          text: 'Vista principal del producto',
          imageUrl: 'https://images.example.com/nimbus.jpg',
          selectorHint: 'article.product-card > img:nth-of-type(1)',
          createdAt: '2026-04-17T01:00:00.000Z',
        },
      ],
    };

    const markdown = generateMarkdown(draft);

    expect(markdown).not.toContain('# Cafetera Nimbus 2L');
    expect(markdown).not.toContain('Precio: $89.900');
    expect(markdown).not.toContain('Fuente: https://store.example.com/products/nimbus');
    expect(markdown).toContain('![Imagen 1](https://images.example.com/nimbus.jpg)');
    expect(markdown).not.toContain('Referencia DOM');
  });

  it('renderiza headings y tablas como markdown semantico', () => {
    const draft: DraftDocument = {
      tabId: 3,
      url: 'https://store.example.com/products/nimbus',
      origin: 'https://store.example.com',
      pageTitle: 'Cafetera Nimbus 2L',
      siteName: 'store.example.com',
      includeContext: false,
      metadata: {
        title: 'Cafetera Nimbus 2L',
      },
      updatedAt: '2026-04-17T01:00:00.000Z',
      items: [
        {
          id: 'heading_1',
          tabId: 3,
          url: 'https://store.example.com/products/nimbus',
          kind: 'element',
          format: 'heading',
          text: 'Especificaciones',
          headingLevel: 2,
          selectorHint: 'section#specs > h2',
          createdAt: '2026-04-17T01:00:00.000Z',
        },
        {
          id: 'table_1',
          tabId: 3,
          url: 'https://store.example.com/products/nimbus',
          kind: 'element',
          format: 'table',
          text: 'Marca | Nimbus / Capacidad | 2L',
          table: {
            headers: ['Campo', 'Valor'],
            rows: [
              ['Marca', 'Nimbus'],
              ['Capacidad', '2L'],
            ],
          },
          createdAt: '2026-04-17T01:01:00.000Z',
        },
      ],
    };

    const markdown = generateMarkdown(draft);

    expect(markdown).toContain('## Especificaciones');
    expect(markdown).toContain('| Campo | Valor |');
    expect(markdown).not.toContain('## Seleccion 1');
    expect(markdown).not.toContain('Fuente:');
  });

  it('preserva el titulo principal como heading capturado', () => {
    const draft: DraftDocument = {
      tabId: 3,
      url: 'https://store.example.com/products/nimbus',
      origin: 'https://store.example.com',
      pageTitle: 'Cafetera Nimbus 2L',
      siteName: 'store.example.com',
      includeContext: false,
      metadata: {
        title: 'Cafetera Nimbus 2L',
      },
      updatedAt: '2026-04-17T01:00:00.000Z',
      items: [
        {
          id: 'heading_1',
          tabId: 3,
          url: 'https://store.example.com/products/nimbus',
          kind: 'element',
          format: 'heading',
          text: 'Cafetera Nimbus 2L',
          headingLevel: 1,
          selectorHint: 'article.product-card > h1',
          createdAt: '2026-04-17T01:00:00.000Z',
        },
      ],
    };

    const markdown = generateMarkdown(draft);

    expect(markdown).toContain('# Cafetera Nimbus 2L');
    expect(markdown).not.toContain('Referencia DOM');
  });

  it('renderiza listas markdown semanticas', () => {
    const draft: DraftDocument = {
      tabId: 4,
      url: 'https://store.example.com/products/nimbus',
      origin: 'https://store.example.com',
      pageTitle: 'Cafetera Nimbus 2L',
      siteName: 'store.example.com',
      includeContext: false,
      metadata: {
        title: 'Cafetera Nimbus 2L',
      },
      updatedAt: '2026-04-17T01:00:00.000Z',
      items: [
        {
          id: 'list_1',
          tabId: 4,
          url: 'https://store.example.com/products/nimbus',
          kind: 'element',
          format: 'list',
          text: 'Apoya la digestion · Mejora la regularidad · Reduce la hinchazon',
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
      ],
    };

    const markdown = generateMarkdown(draft);

    expect(markdown).toContain('- Apoya la digestion');
    expect(markdown).toContain('- Mejora la regularidad');
    expect(markdown).toContain('1. Primer paso');
    expect(markdown).toContain('2. Segundo paso');
    expect(markdown).not.toContain('# Cafetera Nimbus 2L');
  });

  it('prepend contexto al inicio cuando el draft lo pide', () => {
    const draft: DraftDocument = {
      tabId: 5,
      url: 'https://store.example.com/products/nimbus',
      origin: 'https://store.example.com',
      pageTitle: 'Cafetera Nimbus 2L',
      siteName: 'store.example.com',
      includeContext: true,
      metadata: {
        title: 'Cafetera Nimbus 2L',
        price: '$89.900',
        seller: 'Nimbus Home',
        availability: 'Disponible',
      },
      updatedAt: '2026-04-17T01:00:00.000Z',
      items: [
        {
          id: 'sel_1',
          tabId: 5,
          url: 'https://store.example.com/products/nimbus',
          kind: 'element',
          format: 'paragraph',
          text: 'Cafetera con jarra termica',
          createdAt: '2026-04-17T01:00:00.000Z',
        },
      ],
    };

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
