import type { MarkdownPreviewBlock } from '@/shared/markdown';
import type { DraftDocument } from '@/shared/types';

export interface SidepanelViewProps {
  draft: DraftDocument | null;
  currentTabId: number | null;
  pickerActive: boolean;
  markdown: string;
  previewBlocks: MarkdownPreviewBlock[];
  statusMessage: string | null;
  onTogglePicker(): void;
  onRestartExtraction(): void;
  onCopyMarkdown(): void;
  onRemoveSelection(itemId: string): void;
}

export function SidepanelView({
  draft,
  currentTabId,
  pickerActive,
  markdown,
  previewBlocks,
  statusMessage,
  onTogglePicker,
  onRestartExtraction,
  onCopyMarkdown,
  onRemoveSelection,
}: SidepanelViewProps) {
  let removableIndex = 0;

  return (
    <div className="panel-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">MD Extractor</p>
          <h1>Extracción ordenada a Markdown</h1>
          <p className="subtle">
            Pestana activa: {currentTabId ?? 'sin contexto'}
            {draft != null ? ` · ${draft.siteName}` : ''}
          </p>
        </div>
        <div className="action-row">
          <button className="secondary" onClick={onRestartExtraction} type="button">
            Extraer de nuevo
          </button>
          <button onClick={onTogglePicker} type="button">
            {pickerActive ? 'Pausar extracción' : 'Activar extracción'}
          </button>
        </div>
      </header>

      {statusMessage != null ? <p className="status-banner">{statusMessage}</p> : null}

      <main className="grid-layout">
        <section className="preview-card" aria-label="Preview markdown">
          <div className="section-header">
            <h2>Preview Markdown</h2>
            <button onClick={onCopyMarkdown} type="button">
              Copiar Markdown
            </button>
          </div>
          {previewBlocks.length === 0 ? (
            <pre>{markdown}</pre>
          ) : (
            <div className="markdown-blocks">
              {previewBlocks.map((block) => {
                const itemId = block.itemId;
                const canRemove = block.removable && itemId != null;
                const blockNumber = canRemove ? ++removableIndex : undefined;

                return (
                  <article className="markdown-block" key={block.key}>
                    <div className="markdown-block-header">
                      {canRemove ? (
                        <button
                          aria-label={`Quitar bloque ${blockNumber}`}
                          className="ghost"
                          onClick={() => {
                            onRemoveSelection(itemId);
                          }}
                          type="button"
                        >
                          Quitar
                        </button>
                      ) : (
                        <span className="markdown-block-spacer" />
                      )}
                    </div>
                    <pre>{block.markdown}</pre>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
