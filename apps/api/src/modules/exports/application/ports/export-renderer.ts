import type {
  ExportColumn,
  ExportFormat,
  ExportTemplateRow,
} from '../../domain/export-templates.js';

export interface RenderedExport {
  buffer: Buffer;
  mime: string;
  extension: 'pdf' | 'xlsx' | 'csv';
}

export abstract class ExportRenderer {
  abstract render(
    format: ExportFormat,
    title: string,
    columns: readonly ExportColumn[],
    rows: readonly ExportTemplateRow[],
  ): Promise<RenderedExport>;
}
