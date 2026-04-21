import { fireEvent, render, screen } from '@testing-library/react';
import { blockKeyFromItem } from '@/shared/draft';
import type { MarkdownPreviewBlock } from '@/shared/markdown';
import type { DraftDocument } from '@/shared/types';
import { SidepanelView } from '@/sidepanel/SidepanelView';

function createDraft(): DraftDocument {
  const items = [
    {
      id: 'sel_1',
      tabId: 7,
      url: 'https://store.example.com/products/nimbus',
      kind: 'element',
      format: 'heading',
      text: 'Cafetera Nimbus 2L',
      orderKey: '0000.0000',
      selectionKey: 'heading:article.product-card > h1',
      createdAt: '2026-04-17T01:00:00.000Z',
    },
    {
      id: 'sel_2',
      tabId: 7,
      url: 'https://store.example.com/products/nimbus',
      kind: 'element',
      format: 'paragraph',
      text: 'Cafetera con jarra termica',
      orderKey: '0000.0001',
      selectionKey: 'paragraph:article.product-card > p',
      createdAt: '2026-04-17T01:01:00.000Z',
    },
  ] satisfies DraftDocument['items'];

  return {
    tabId: 7,
    url: 'https://store.example.com/products/nimbus',
    origin: 'https://store.example.com',
    pageTitle: 'Cafetera Nimbus 2L',
    siteName: 'store.example.com',
    includeContext: false,
    metadata: {
      title: 'Cafetera Nimbus 2L',
      price: '$89.900',
    },
    blocksByKey: Object.fromEntries(items.map((item) => [blockKeyFromItem(item), item])),
    orderedKeys: items.map(blockKeyFromItem),
    updatedAt: '2026-04-17T01:00:00.000Z',
    items,
  };
}

describe('SidepanelView', () => {
  it('renderiza una interfaz reducida con controles y markdown', () => {
    render(
      <SidepanelView
        currentTabId={null}
        draft={null}
        markdown="# Sin contenido"
        previewBlocks={[]}
        onCopyMarkdown={() => undefined}
        onRemoveSelection={() => undefined}
        onRestartExtraction={() => undefined}
        onTogglePicker={() => undefined}
        pickerActive={false}
        statusMessage={null}
      />,
    );

    expect(screen.getByRole('button', { name: /Activar extracción/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Extraer de nuevo/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Acciones/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reiniciar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Limpiar todo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Agregar contexto/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Preview markdown')).toBeInTheDocument();

    expect(screen.queryByText('Selecciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Contexto')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nota manual')).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('dispara callbacks visibles del flujo simplificado', () => {
    const onTogglePicker = vi.fn();
    const onRestartExtraction = vi.fn();
    const onCopyMarkdown = vi.fn();
    const onRemoveSelection = vi.fn();
    const previewBlocks: MarkdownPreviewBlock[] = [
      {
        key: 'sel_1',
        itemId: 'sel_1',
        markdown: '# Cafetera Nimbus 2L',
        removable: true,
      },
      {
        key: 'sel_2',
        itemId: 'sel_2',
        markdown: 'Cafetera con jarra termica',
        removable: true,
      },
    ];

    render(
      <SidepanelView
        currentTabId={7}
        draft={createDraft()}
        markdown="# Draft"
        previewBlocks={previewBlocks}
        onCopyMarkdown={onCopyMarkdown}
        onRemoveSelection={onRemoveSelection}
        onRestartExtraction={onRestartExtraction}
        onTogglePicker={onTogglePicker}
        pickerActive={true}
        statusMessage="Extracción lista"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Pausar extracción/i }));
    fireEvent.click(screen.getByRole('button', { name: /Extraer de nuevo/i }));
    fireEvent.click(screen.getByRole('button', { name: /Copiar Markdown/i }));
    fireEvent.click(screen.getByRole('button', { name: /Quitar bloque 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Quitar bloque 2/i }));

    expect(onTogglePicker).toHaveBeenCalled();
    expect(onRestartExtraction).toHaveBeenCalled();
    expect(onCopyMarkdown).toHaveBeenCalled();
    expect(onRemoveSelection).toHaveBeenNthCalledWith(1, 'sel_1');
    expect(onRemoveSelection).toHaveBeenNthCalledWith(2, 'sel_2');
  });

  it('solo muestra botones de quitar para bloques removibles', () => {
    const previewBlocks: MarkdownPreviewBlock[] = [
      {
        key: 'context',
        markdown: '## Contexto\n- Sitio: store.example.com',
        removable: false,
      },
      {
        key: 'sel_1',
        itemId: 'sel_1',
        markdown: '# Cafetera Nimbus 2L',
        removable: true,
      },
    ];

    render(
      <SidepanelView
        currentTabId={7}
        draft={createDraft()}
        markdown="## Contexto\n\n# Cafetera Nimbus 2L"
        previewBlocks={previewBlocks}
        onCopyMarkdown={() => undefined}
        onRemoveSelection={() => undefined}
        onRestartExtraction={() => undefined}
        onTogglePicker={() => undefined}
        pickerActive={false}
        statusMessage={null}
      />,
    );

    expect(screen.getByText('## Contexto', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quitar bloque 1/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quitar bloque 2/i })).not.toBeInTheDocument();
  });
});
