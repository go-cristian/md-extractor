import type { ChangeEvent, DragEvent } from 'react';

import type { DraftDocument, SelectionItem } from '@/shared/types';

export interface SidepanelViewProps {
  draft: DraftDocument | null;
  currentTabId: number | null;
  includeContextEnabled: boolean;
  pickerActive: boolean;
  noteInput: string;
  noteLabelInput: string;
  markdown: string;
  statusMessage: string | null;
  onTogglePicker(): void;
  onToggleContext(): void;
  onClearDraft(): void;
  onCopyMarkdown(): void;
  onDeleteItem(itemId: string): void;
  onLabelChange(itemId: string, value: string): void;
  onDragStart(itemId: string): void;
  onDrop(itemId: string): void;
  onNoteInputChange(value: string): void;
  onNoteLabelInputChange(value: string): void;
  onSaveNote(): void;
}

function renderItemSummary(item: SelectionItem): string {
  return item.text.length > 120 ? `${item.text.slice(0, 120)}...` : item.text;
}

function formatLabel(item: SelectionItem): string {
  switch (item.format) {
    case 'heading':
      return 'titulo';
    case 'paragraph':
      return 'texto';
    case 'list':
      return 'lista';
    case 'table':
      return 'tabla';
    case 'image':
      return 'imagen';
    case 'note':
      return 'nota';
    default:
      return 'texto';
  }
}

export function SidepanelView({
  draft,
  currentTabId,
  includeContextEnabled,
  pickerActive,
  noteInput,
  noteLabelInput,
  markdown,
  statusMessage,
  onTogglePicker,
  onToggleContext,
  onClearDraft,
  onCopyMarkdown,
  onDeleteItem,
  onLabelChange,
  onDragStart,
  onDrop,
  onNoteInputChange,
  onNoteLabelInputChange,
  onSaveNote,
}: SidepanelViewProps) {
  return (
    <div className="panel-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">MD Extractor</p>
          <h1>Markdown asistido por selecciones</h1>
          <p className="subtle">
            Pestana activa: {currentTabId ?? 'sin contexto'}
            {draft != null ? ` · ${draft.siteName}` : ''}
          </p>
        </div>
        <div className="action-row">
          <button className="secondary" onClick={onClearDraft} type="button">
            Limpiar
          </button>
          <button
            className="secondary"
            disabled={draft == null}
            onClick={onToggleContext}
            type="button"
          >
            {includeContextEnabled ? 'Quitar contexto' : 'Agregar contexto'}
          </button>
          <button onClick={onTogglePicker} type="button">
            {pickerActive ? 'Pausar picker' : 'Activar picker'}
          </button>
        </div>
      </header>

      {statusMessage != null ? <p className="status-banner">{statusMessage}</p> : null}

      <section className="meta-card" aria-label="Resumen pagina">
        <h2>Contexto</h2>
        {draft == null ? (
          <p>No hay contenido todavia. Activa el picker para agregar bloques.</p>
        ) : (
          <dl>
            <div>
              <dt>Titulo</dt>
              <dd>{draft.metadata.title}</dd>
            </div>
            <div>
              <dt>URL</dt>
              <dd>{draft.url}</dd>
            </div>
            <div>
              <dt>Precio</dt>
              <dd>{draft.metadata.price ?? 'Sin detectar'}</dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>{draft.items.length}</dd>
            </div>
            <div>
              <dt>Contexto en Markdown</dt>
              <dd>{includeContextEnabled ? 'Activo' : 'Inactivo'}</dd>
            </div>
          </dl>
        )}
      </section>

      <main className="grid-layout">
        <section className="list-card" aria-label="Selecciones guardadas">
          <div className="section-header">
            <h2>Selecciones</h2>
            <span>{draft?.items.length ?? 0}</span>
          </div>

          <div className="note-editor">
            <input
              aria-label="Etiqueta de nota"
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onNoteLabelInputChange(event.target.value)
              }
              placeholder="Etiqueta opcional"
              type="text"
              value={noteLabelInput}
            />
            <textarea
              aria-label="Nota manual"
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                onNoteInputChange(event.target.value)
              }
              placeholder="Agrega una nota propia al documento"
              rows={4}
              value={noteInput}
            />
            <button onClick={onSaveNote} type="button">
              Guardar nota
            </button>
          </div>

          <ul className="selection-list">
            {draft?.items.map((item) => (
              <li
                className="selection-item"
                draggable
                key={item.id}
                onDragOver={(event: DragEvent<HTMLLIElement>) => event.preventDefault()}
                onDragStart={() => onDragStart(item.id)}
                onDrop={() => onDrop(item.id)}
              >
                <div className="selection-head">
                  <span className="kind-pill">{formatLabel(item)}</span>
                  <button className="ghost" onClick={() => onDeleteItem(item.id)} type="button">
                    Eliminar
                  </button>
                </div>
                <input
                  aria-label={`Etiqueta ${item.id}`}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    onLabelChange(item.id, event.target.value)
                  }
                  placeholder="Etiqueta del bloque"
                  type="text"
                  value={item.label ?? ''}
                />
                <p>{renderItemSummary(item)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="preview-card" aria-label="Preview markdown">
          <div className="section-header">
            <h2>Preview Markdown</h2>
            <button onClick={onCopyMarkdown} type="button">
              Copiar Markdown
            </button>
          </div>
          <pre>{markdown}</pre>
        </section>
      </main>
    </div>
  );
}
