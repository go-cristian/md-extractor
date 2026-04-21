import { getOrderedItems } from '@/shared/draft';
import type { DraftDocument, SelectionItem, SelectionTable } from '@/shared/types';

export interface MarkdownPreviewBlock {
  key: string;
  itemId?: string | undefined;
  markdown: string;
  removable: boolean;
}

function defaultHeading(item: SelectionItem, index: number): string {
  if (item.format === 'note') {
    return `Nota ${index + 1}`;
  }

  return `Bloque ${index + 1}`;
}

function renderList(item: SelectionItem): string[] {
  const listItems = item.listItems ?? [item.text];
  return listItems.map((entry, index) =>
    item.orderedList ? `${index + 1}. ${entry}` : `- ${entry}`,
  );
}

function renderTable(table: SelectionTable): string[] {
  const headers =
    table.headers.length > 0
      ? table.headers
      : (table.rows[0]?.map((_value, index) => `Columna ${index + 1}`) ?? []);
  const rows = table.headers.length > 0 ? table.rows : table.rows;
  if (headers.length === 0) {
    return [];
  }

  const escapeCell = (value: string) => value.replace(/\|/g, '\\|');
  return [
    `| ${headers.map(escapeCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
  ];
}

function renderContent(item: SelectionItem, index: number): string[] {
  const format = item.format;

  switch (format) {
    case 'heading': {
      const headingLevel = Math.min(6, Math.max(1, item.headingLevel ?? 2));
      return [`${'#'.repeat(headingLevel)} ${item.label?.trim() || item.text}`];
    }
    case 'list':
      return renderList(item);
    case 'table':
      return item.table == null ? [item.text] : renderTable(item.table);
    case 'image': {
      const alt = item.label?.trim() || `Imagen ${index + 1}`;
      if (item.imageUrl == null) {
        return item.text.length > 0 ? [item.text] : [];
      }

      return item.text.length > 0
        ? [`![${alt}](${item.imageUrl})`, '', item.text]
        : [`![${alt}](${item.imageUrl})`];
    }
    case 'note':
      return [`## ${item.label?.trim() || defaultHeading(item, index)}`, item.text];
    default:
      if (item.label?.trim() != null && item.label.trim().length > 0) {
        return [`## ${item.label.trim()}`, item.text];
      }
      return [item.text];
  }
}

function renderItem(item: SelectionItem, index: number): string {
  return renderContent(item, index).join('\n');
}

function renderContext(draft: DraftDocument): string[] {
  const lines = ['## Contexto'];
  const title = draft.metadata.title ?? draft.pageTitle;

  lines.push(`- Titulo: ${title}`);
  lines.push(`- Sitio: ${draft.siteName}`);
  lines.push(`- URL: ${draft.url}`);

  if (draft.metadata.price != null) {
    lines.push(`- Precio: ${draft.metadata.price}`);
  }
  if (draft.metadata.currency != null) {
    lines.push(`- Moneda: ${draft.metadata.currency}`);
  }
  if (draft.metadata.seller != null) {
    lines.push(`- Vendedor: ${draft.metadata.seller}`);
  }
  if (draft.metadata.rating != null) {
    lines.push(`- Rating: ${draft.metadata.rating}`);
  }
  if (draft.metadata.availability != null) {
    lines.push(`- Disponibilidad: ${draft.metadata.availability}`);
  }
  if (draft.metadata.heroImageUrl != null) {
    lines.push(`- Imagen principal: ${draft.metadata.heroImageUrl}`);
  }

  return lines;
}

export function buildMarkdownPreviewBlocks(draft: DraftDocument | null): MarkdownPreviewBlock[] {
  if (draft == null) {
    return [];
  }

  const sections: MarkdownPreviewBlock[] = [];
  if (draft.includeContext === true) {
    sections.push({
      key: 'context',
      markdown: renderContext(draft).join('\n'),
      removable: false,
    });
  }

  getOrderedItems(draft).forEach((item, index) => {
    const markdown = renderItem(item, index);
    if (markdown.length === 0) {
      return;
    }

    sections.push({
      key: item.id,
      itemId: item.id,
      markdown,
      removable: true,
    });
  });

  return sections;
}

export function generateMarkdown(draft: DraftDocument | null): string {
  if (draft == null) {
    return '# Sin contenido\n\nActiva el picker y agrega selecciones para construir el Markdown.';
  }

  const sections = buildMarkdownPreviewBlocks(draft).map((block) => block.markdown);

  if (sections.length === 0) {
    return 'Aun no hay selecciones guardadas.';
  }

  return sections.join('\n\n').trim();
}
