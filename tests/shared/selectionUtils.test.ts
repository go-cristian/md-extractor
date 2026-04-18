import {
  compactHtmlSnippet,
  extractVisibleTextFromElement,
  inferListFromText,
  normalizeOptionalText,
  normalizeText,
} from '@/shared/selectionUtils';

describe('selectionUtils', () => {
  it('normaliza espacios repetidos', () => {
    expect(normalizeText('  uno\n\n dos   tres  ')).toBe('uno dos tres');
  });

  it('retorna undefined para texto vacio opcional', () => {
    expect(normalizeOptionalText('   ')).toBeUndefined();
  });

  it('compacta snippets largos de html', () => {
    const snippet = compactHtmlSnippet(`<div>${'a'.repeat(260)}</div>`);
    expect(snippet).toContain('...');
  });

  it('extrae texto visible y descarta scripts, estilos y nodos ocultos', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <style>.title { color: red; }</style>
      <script>window.foo = "bar";</script>
      <div class="title">Titulo visible</div>
      <p hidden>Texto oculto</p>
      <p aria-hidden="true">Mas ruido</p>
      <p>Precio final</p>
    `;

    expect(extractVisibleTextFromElement(container)).toBe('Titulo visible Precio final');
  });

  it('infiere bullets de texto multilinea como lista no ordenada', () => {
    expect(
      inferListFromText(`
        • Apoya la digestion
        • Mejora la regularidad
        • Reduce la hinchazon
      `),
    ).toEqual({
      items: ['Apoya la digestion', 'Mejora la regularidad', 'Reduce la hinchazon'],
      ordered: false,
    });
  });

  it('infiere listas numeradas multilinea como lista ordenada', () => {
    expect(
      inferListFromText(`
        1. Primer paso
        2. Segundo paso
        3. Tercer paso
      `),
    ).toEqual({
      items: ['Primer paso', 'Segundo paso', 'Tercer paso'],
      ordered: true,
    });
  });

  it('no convierte parrafos multilinea ambiguos en listas', () => {
    expect(
      inferListFromText(`
        Compatible con 10 cepas activas.
        Formula estable para uso diario.
      `),
    ).toBeUndefined();
  });
});
