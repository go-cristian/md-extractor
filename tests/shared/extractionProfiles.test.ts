import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractWithSiteProfile } from '@/shared/extractionProfiles';
import type { SiteExtractionProfile } from '@/shared/types';

function loadFixture(name: string): Document {
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures', name), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('extractWithSiteProfile', () => {
  it('revela y extrae bloques dirigidos en Amazon antes del fallback genérico', () => {
    const document = loadFixture('amazon-product.html');
    const url = new URL('https://www.amazon.com/dp/B000TEST');

    const result = extractWithSiteProfile(document, url);

    expect(result).not.toBeNull();
    if (result == null) {
      throw new Error('El perfil de Amazon no fue detectado.');
    }

    expect(result.profileId).toBe('amazon');
    expect(result.revealApplied).toBe(true);
    expect(result.selections[0]?.format).toBe('heading');
    expect(result.selections[0]?.text).toBe('Sony WH-1000XM5 Wireless Headphones');
    expect(
      result.selections.some((selection) => selection.text.includes('Battery life up to 30 hours')),
    ).toBe(true);
    expect(
      result.selections.some((selection) =>
        selection.text.includes('Customers often keep this item'),
      ),
    ).toBe(false);
    expect(
      result.selections.some((selection) => selection.text.includes('Jerusalem artichoke root')),
    ).toBe(true);
    expect(result.selections.some((selection) => selection.text.includes('027242923473'))).toBe(
      true,
    );
    expect(result.selections.some((selection) => selection.text.includes('Midnight Blue'))).toBe(
      true,
    );
    expect(
      result.selections.some((selection) =>
        selection.text.includes('Report an issue with this product or seller'),
      ),
    ).toBe(false);
  });

  it('retorna null cuando ningún perfil aplica', () => {
    const document = loadFixture('generic-product.html');
    const url = new URL('https://store.example.com/products/nimbus');

    expect(extractWithSiteProfile(document, url)).toBeNull();
  });

  it('soporta reveal programático por texto exacto y normaliza los targets revelados', () => {
    const document = new DOMParser().parseFromString(
      `
        <div id="app">
          <a>Open details</a>
          <div id="details" hidden><p>Detailed specs from hidden content.</p></div>
        </div>
      `,
      'text/html',
    );
    const profile: SiteExtractionProfile = {
      id: 'custom-reveal',
      signals: ['#app'],
      reveal: [
        {
          type: 'click',
          text: 'Open details',
          label: 'Open details section',
          revealSelectors: ['#details'],
        },
      ],
      blocks: [{ type: 'paragraph', selectors: ['#details p'] }],
    };

    const result = extractWithSiteProfile(document, new URL('https://example.com/demo'), [profile]);

    expect(result).not.toBeNull();
    expect(result?.revealApplied).toBe(true);
    expect(document.querySelector('#details')?.hasAttribute('hidden')).toBe(false);
    expect(
      result?.selections.some((selection) =>
        selection.text.includes('Detailed specs from hidden content.'),
      ),
    ).toBe(true);
  });

  it('ancla el resultado al título canónico y elimina duplicados textuales del mismo título', () => {
    const document = new DOMParser().parseFromString(
      `
        <div id="app">
          <table id="pre-title-table"><tr><th>Color</th><td>Blue</td></tr></table>
          <p id="duplicate-title">Sample Product</p>
          <h1 id="productTitle">Sample Product</h1>
          <p id="after-title">Main description after title.</p>
        </div>
      `,
      'text/html',
    );
    const profile: SiteExtractionProfile = {
      id: 'anchored-profile',
      signals: ['#app'],
      anchorSelectors: ['#productTitle'],
      blocks: [
        { type: 'table', selectors: ['#pre-title-table'] },
        { type: 'paragraph', selectors: ['#duplicate-title', '#after-title'] },
        { type: 'heading', selectors: ['#productTitle'], headingLevel: 1 },
      ],
    };

    const result = extractWithSiteProfile(document, new URL('https://example.com/demo'), [profile]);

    expect(result).not.toBeNull();
    expect(result?.selections[0]?.format).toBe('heading');
    expect(result?.selections[0]?.text).toBe('Sample Product');
    expect(
      result?.selections.some(
        (selection) => selection.format === 'paragraph' && selection.text === 'Sample Product',
      ),
    ).toBe(false);
    expect(result?.selections.some((selection) => selection.text.includes('Blue'))).toBe(true);
    expect(
      result?.selections.some((selection) =>
        selection.text.includes('Main description after title.'),
      ),
    ).toBe(true);
  });

  it('en Amazon filtra ruido de entrega y listas, omite la hero image y fusiona tablas simples del side sheet', () => {
    const document = loadFixture('amazon-product-noisy.html');
    const url = new URL('https://www.amazon.com/dp/B079H53D2B');

    const result = extractWithSiteProfile(document, url);

    expect(result).not.toBeNull();
    if (result == null) {
      throw new Error('El perfil de Amazon no fue detectado.');
    }

    expect(result.selections[0]?.format).toBe('heading');
    expect(result.selections[0]?.text).toContain("Physician's Choice Probióticos 60 mil millones");
    expect(
      result.selections.some((selection) => selection.text.includes('Enviar a Cristian')),
    ).toBe(false);
    expect(
      result.selections.some((selection) =>
        selection.text.includes('No se puede agregar el artículo a la Lista'),
      ),
    ).toBe(false);
    expect(
      result.selections.some((selection) =>
        selection.text.includes('No puede enviarse este producto al punto de entrega seleccionado'),
      ),
    ).toBe(false);
    expect(
      result.selections
        .filter((selection) => selection.text.includes('US$'))
        .map((selection) => selection.text),
    ).toEqual(['US$24.97']);
    expect(
      result.selections.some(
        (selection) =>
          selection.format === 'paragraph' &&
          selection.text.includes('Physician&#39;s Choice Probióticos 60 mil millones'),
      ),
    ).toBe(false);
    expect(result.selections.some((selection) => selection.format === 'image')).toBe(false);

    const mergedTable = result.selections.find(
      (selection) =>
        selection.format === 'table' &&
        selection.table?.headers.join('|') === 'Campo|Valor' &&
        selection.table.rows.some(
          (row) => row[0] === 'Total del paquete según la medida elegida para referenciar precio',
        ),
    );

    expect(mergedTable?.table).toEqual({
      headers: ['Campo', 'Valor'],
      rows: [
        ['Total del paquete según la medida elegida para referenciar precio', '30 Conteo'],
        ['Dimensiones Artículo', '4,5 x 2,4 x 2,4 pulgadas'],
        ['Número de artículos', '1'],
        ['Total de raciones por envase', '30'],
        ['Sabor', 'Probiótico 60B'],
        ['Aditivos', 'Acidófilo'],
        ['Color', 'No'],
      ],
    });
    expect(
      result.selections.some(
        (selection) =>
          selection.format === 'table' &&
          selection.table?.rows.length === 1 &&
          selection.table.rows[0]?.[0] === 'Color',
      ),
    ).toBe(false);
  });

  it('en Amazon captura información importante completa desde DOM visible o preloaded y colapsa headings repetidos', () => {
    const document = loadFixture('amazon-product-important-info.html');
    const url = new URL('https://www.amazon.com/dp/B079H53D2B');

    const result = extractWithSiteProfile(document, url);

    expect(result).not.toBeNull();
    if (result == null) {
      throw new Error('El perfil de Amazon no fue detectado.');
    }

    expect(result.selections[0]?.format).toBe('heading');
    expect(result.selections[0]?.text).toContain("Physician's Choice Probióticos 60 mil millones");
    expect(result.selections.some((selection) => selection.text === 'Información importante')).toBe(
      true,
    );
    expect(
      result.selections.some(
        (selection) =>
          selection.format === 'heading' && selection.text === 'Información de seguridad',
      ),
    ).toBe(true);
    expect(
      result.selections.some(
        (selection) => selection.format === 'heading' && selection.text === 'Indicaciones',
      ),
    ).toBe(true);
    expect(
      result.selections.some(
        (selection) => selection.format === 'heading' && selection.text === 'Ingredientes',
      ),
    ).toBe(true);
    expect(
      result.selections.some(
        (selection) => selection.format === 'heading' && selection.text === 'Instrucciones',
      ),
    ).toBe(true);

    const disclaimerHeadings = result.selections.filter(
      (selection) =>
        selection.format === 'heading' &&
        selection.text === 'Exclusión de garantías y responsabilidad',
    );
    expect(disclaimerHeadings).toHaveLength(1);

    expect(
      result.selections.some((selection) =>
        selection.text.includes('Mantener fuera del alcance de los niños.'),
      ),
    ).toBe(true);
    expect(
      result.selections.some((selection) =>
        selection.text.includes('Tomar para la salud intestinal'),
      ),
    ).toBe(true);
    expect(
      result.selections.some((selection) =>
        selection.text.includes('Lactobacillus casei, Lactobacillus acidophilus'),
      ),
    ).toBe(true);
    expect(
      result.selections.some((selection) =>
        selection.text.includes(
          'Como suplemento dietético, tome una (1) cápsula vegetal una vez al día.',
        ),
      ),
    ).toBe(true);
    expect(
      result.selections.some((selection) =>
        selection.text.includes(
          'Las declaraciones relacionadas con suplementos dietéticos no han sido evaluadas',
        ),
      ),
    ).toBe(true);
    expect(
      result.selections.some((selection) =>
        selection.text.includes('Informar de un problema con este producto o vendedor'),
      ),
    ).toBe(false);
    expect(
      result.selections.some((selection) =>
        selection.text.includes('¿Te pareció útil esta función de resumen del producto?'),
      ),
    ).toBe(false);
  });

  it('en Substack ancla al post canónico y excluye chrome de publicación, CTA y comentarios', () => {
    const document = loadFixture('substack-post.html');
    const url = new URL('https://cosmobiota.substack.com/p/that-two-times-e-to-the-two-i-pi');

    const result = extractWithSiteProfile(document, url);

    expect(result).not.toBeNull();
    if (result == null) {
      throw new Error('El perfil de Substack no fue detectado.');
    }

    expect(result.profileId).toBe('substack');
    expect(result.revealApplied).toBe(false);
    expect(result.selections[0]?.format).toBe('heading');
    expect(result.selections[0]?.headingLevel).toBe(1);
    expect(result.selections[0]?.text).toBe(
      'That "Two Times e to the Two-i-pi" Thing from Project Hail Mary, Explained',
    );
    expect(
      result.selections.some(
        (selection) =>
          selection.format === 'heading' &&
          selection.headingLevel === 3 &&
          selection.text.includes('A romp through number theory'),
      ),
    ).toBe(true);
    expect(
      result.selections.some(
        (selection) =>
          selection.format === 'paragraph' && selection.text.toLowerCase() === 'graham lau',
      ),
    ).toBe(true);
    expect(
      result.selections.some(
        (selection) => selection.format === 'paragraph' && selection.text === 'Feb 16, 2026',
      ),
    ).toBe(true);
    expect(
      result.selections.some(
        (selection) =>
          selection.format === 'paragraph' &&
          selection.text.includes('The Astrobiology and Panzoic Book Club'),
      ),
    ).toBe(true);
    expect(
      result.selections.some(
        (selection) =>
          selection.format === 'heading' &&
          selection.headingLevel === 2 &&
          selection.text === 'Math time!',
      ),
    ).toBe(true);
    expect(
      result.selections.some(
        (selection) =>
          selection.format === 'heading' &&
          selection.headingLevel === 3 &&
          selection.text === 'Types of Numbers',
      ),
    ).toBe(true);
    expect(
      result.selections.some(
        (selection) =>
          selection.format === 'list' &&
          selection.listItems?.some((item) =>
            item.includes('Saying 2e2πi is actually the same thing as saying 2'),
          ) === true,
      ),
    ).toBe(true);
    expect(
      result.selections.some(
        (selection) =>
          selection.format === 'image' &&
          selection.imageUrl?.includes('817b3a0e-54df-445b-ae13-128df426544b') === true,
      ),
    ).toBe(true);

    expect(
      result.selections.some(
        (selection) => selection.format === 'heading' && selection.text === 'The Cosmobiologist',
      ),
    ).toBe(false);
    expect(result.selections.some((selection) => selection.text === 'Subscribe')).toBe(false);
    expect(result.selections.some((selection) => selection.text === 'Sign in')).toBe(false);
    expect(result.selections.some((selection) => selection.text === 'Share')).toBe(false);
    expect(result.selections.some((selection) => selection.text === 'Comments')).toBe(false);
    expect(
      result.selections.some((selection) =>
        selection.text.includes('reader-supported publication'),
      ),
    ).toBe(false);
    expect(
      result.selections.some((selection) =>
        selection.text.includes('Subscribe to The Cosmobiologist'),
      ),
    ).toBe(false);
  });
});
