import { fireEvent, render, screen } from '@testing-library/react';
import type { DraftDocument } from '@/shared/types';
import { SidepanelView } from '@/sidepanel/SidepanelView';

function createDraft(): DraftDocument {
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
    updatedAt: '2026-04-17T01:00:00.000Z',
    items: [
      {
        id: 'sel_1',
        tabId: 7,
        url: 'https://store.example.com/products/nimbus',
        kind: 'element',
        format: 'paragraph',
        text: 'Cafetera con jarra termica',
        label: 'Descripcion',
        createdAt: '2026-04-17T01:00:00.000Z',
      },
      {
        id: 'sel_2',
        tabId: 7,
        url: 'https://store.example.com/products/nimbus',
        kind: 'textRange',
        format: 'paragraph',
        text: 'Temporizador programable',
        createdAt: '2026-04-17T01:01:00.000Z',
      },
    ],
  };
}

describe('SidepanelView', () => {
  it('renderiza el estado vacio', () => {
    render(
      <SidepanelView
        currentTabId={null}
        draft={null}
        includeContextEnabled={false}
        markdown="# Sin contenido"
        noteInput=""
        noteLabelInput=""
        onClearDraft={() => undefined}
        onCopyMarkdown={() => undefined}
        onDeleteItem={() => undefined}
        onDragStart={() => undefined}
        onDrop={() => undefined}
        onLabelChange={() => undefined}
        onNoteInputChange={() => undefined}
        onNoteLabelInputChange={() => undefined}
        onSaveNote={() => undefined}
        onToggleContext={() => undefined}
        onTogglePicker={() => undefined}
        pickerActive={false}
        statusMessage={null}
      />,
    );

    expect(screen.getByText(/No hay contenido todavia/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activar picker/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agregar contexto/i })).toBeDisabled();
  });

  it('dispara callbacks de contexto, etiquetas, nota y reorder', () => {
    const onToggleContext = vi.fn();
    const onLabelChange = vi.fn();
    const onSaveNote = vi.fn();
    const onDragStart = vi.fn();
    const onDrop = vi.fn();

    render(
      <SidepanelView
        currentTabId={7}
        draft={createDraft()}
        includeContextEnabled={false}
        markdown="# Draft"
        noteInput="nota"
        noteLabelInput="recordatorio"
        onClearDraft={() => undefined}
        onCopyMarkdown={() => undefined}
        onDeleteItem={() => undefined}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onLabelChange={onLabelChange}
        onNoteInputChange={() => undefined}
        onNoteLabelInputChange={() => undefined}
        onSaveNote={onSaveNote}
        onToggleContext={onToggleContext}
        onTogglePicker={() => undefined}
        pickerActive={true}
        statusMessage="Picker activo"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Agregar contexto/i }));
    fireEvent.change(screen.getByLabelText('Etiqueta sel_1'), {
      target: { value: 'Nueva etiqueta' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar nota/i }));

    const items = screen.getAllByRole('listitem');
    fireEvent.dragStart(items[0] as HTMLElement);
    fireEvent.drop(items[1] as HTMLElement);

    expect(onToggleContext).toHaveBeenCalled();
    expect(onLabelChange).toHaveBeenCalledWith('sel_1', 'Nueva etiqueta');
    expect(onSaveNote).toHaveBeenCalled();
    expect(onDragStart).toHaveBeenCalledWith('sel_1');
    expect(onDrop).toHaveBeenCalledWith('sel_2');
  });
});
