import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { DefaultExportRenderer } from './default-export-renderer.js';
import type { ExportColumn, ExportTemplateRow } from '../domain/export-templates.js';

/**
 * RB1-24: la salida PDF/XLSX/CSV se genera sin ejecutar fórmulas del contenido.
 */

const columns: ExportColumn[] = [
  { key: 'programa', label: 'Programa' },
  { key: 'matriculados', label: 'Matriculados' },
  { key: 'nota', label: 'Nota' },
];

const rows: ExportTemplateRow[] = [
  { programa: 'Artes', matriculados: 10, nota: '=HYPERLINK("http://malo")' },
  { programa: 'Música, coral', matriculados: 5, nota: '+SUMA(A1)' },
];

const renderer = new DefaultExportRenderer();

describe('renderizado de exportaciones', () => {
  it('genera CSV con BOM, comillas y neutralización de fórmulas', async () => {
    const result = await renderer.render('csv', 'Matrículas', columns, rows);

    expect(result).toMatchObject({ mime: 'text/csv; charset=utf-8', extension: 'csv' });

    const text = result.buffer.toString('utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('"Programa","Matriculados","Nota"');
    expect(text).toContain('"Artes","10","\'=HYPERLINK(""http://malo"")"');
    expect(text).toContain('"Música, coral","5","\'+SUMA(A1)"');
    expect(text.split('\r\n')).toHaveLength(4);
  });

  it('genera XLSX con encabezados y fórmulas neutralizadas', async () => {
    const result = await renderer.render('xlsx', 'Matrículas', columns, rows);

    expect(result).toMatchObject({
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    });
    expect(result.buffer.subarray(0, 2).toString('ascii')).toBe('PK');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    expect(sheet?.getRow(1).values).toEqual([undefined, 'Programa', 'Matriculados', 'Nota']);
    expect(sheet?.getCell('A2').value).toBe('Artes');
    expect(sheet?.getCell('B2').value).toBe(10);
    expect(sheet?.getCell('C2').value).toBe('\'=HYPERLINK("http://malo")');
  });

  it('genera un PDF válido y no vacío', async () => {
    const result = await renderer.render('pdf', 'Matrículas', columns, rows);

    expect(result).toMatchObject({ mime: 'application/pdf', extension: 'pdf' });
    expect(result.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.buffer.length).toBeGreaterThan(500);
  });
});
