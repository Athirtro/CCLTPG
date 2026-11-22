import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

import type { RenderedExport } from '../application/ports/export-renderer.js';
import type { ExportRenderer } from '../application/ports/export-renderer.js';
import type { ExportColumn, ExportFormat, ExportTemplateRow } from '../domain/export-templates.js';

export class DefaultExportRenderer implements ExportRenderer {
  async render(
    format: ExportFormat,
    title: string,
    columns: readonly ExportColumn[],
    rows: readonly ExportTemplateRow[],
  ): Promise<RenderedExport> {
    switch (format) {
      case 'csv':
        return {
          buffer: renderCsv(columns, rows),
          mime: 'text/csv; charset=utf-8',
          extension: 'csv',
        };
      case 'xlsx':
        return {
          buffer: await renderXlsx(title, columns, rows),
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          extension: 'xlsx',
        };
      case 'pdf':
        return {
          buffer: await renderPdf(title, columns, rows),
          mime: 'application/pdf',
          extension: 'pdf',
        };
    }
  }
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/u;

/** Neutraliza fórmulas sin alterar el texto visible para el usuario. */
function sanitizeCell(value: string | number): string {
  const text = String(value);
  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

function renderCsv(columns: readonly ExportColumn[], rows: readonly ExportTemplateRow[]): Buffer {
  const lines = [columns.map((column) => csvField(column.label)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvField(row[column.key] ?? '')).join(','));
  }

  // BOM para que Excel abra el archivo como UTF-8.
  return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

function csvField(value: string | number): string {
  const text = sanitizeCell(value);
  return `"${text.replace(/"/gu, '""')}"`;
}

async function renderXlsx(
  title: string,
  columns: readonly ExportColumn[],
  rows: readonly ExportTemplateRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CCLTPG';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(title.slice(0, 31) || 'Reporte');
  worksheet.addRow(columns.map((column) => column.label));
  worksheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    worksheet.addRow(
      columns.map((column) => {
        const value = row[column.key] ?? '';
        return typeof value === 'number' ? value : sanitizeCell(value);
      }),
    );
  }

  columns.forEach((column, index) => {
    const width = Math.max(
      column.label.length + 2,
      ...rows.map((row) => String(row[column.key] ?? '').length + 2),
    );
    worksheet.getColumn(index + 1).width = Math.min(width, 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function renderPdf(
  title: string,
  columns: readonly ExportColumn[],
  rows: readonly ExportTemplateRow[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    document.fontSize(16).text(title, { underline: true });
    document.moveDown(0.8);

    for (const row of rows) {
      const line = columns
        .map((column) => `${column.label}: ${sanitizeCell(row[column.key] ?? '')}`)
        .join('   |   ');
      document.fontSize(10).text(line);
      document.moveDown(0.25);
    }

    document.end();
  });
}
