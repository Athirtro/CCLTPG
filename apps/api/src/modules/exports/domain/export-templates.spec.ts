import { describe, expect, it } from 'vitest';

import {
  EXPORT_FORMATS,
  findExportTemplate,
  isExportTemplateParameterError,
} from './export-templates.js';

/**
 * D56: plantillas cerradas en código que validan el JSON saneado antes de
 * renderizar y acotan los valores de entrada.
 */

const template = findExportTemplate('matriculas-por-programa');

function build(parametros: unknown) {
  expect(template).not.toBeNull();
  return template!.build(parametros);
}

function parameterErrorMessage(parametros: unknown): string {
  try {
    build(parametros);
  } catch (error) {
    expect(isExportTemplateParameterError(error)).toBe(true);
    return (error as Error).message;
  }
  throw new Error('Se esperaba un error de parámetros.');
}

describe('registro de plantillas de exportación', () => {
  it('expone formatos y una única plantilla de compuerta', () => {
    expect([...EXPORT_FORMATS]).toEqual(['pdf', 'xlsx', 'csv']);
    expect(template).toMatchObject({
      codigo: 'matriculas-por-programa',
      version: 1,
      columns: [
        { key: 'programa', label: 'Programa' },
        { key: 'matriculados', label: 'Matriculados' },
        { key: 'activos', label: 'Activos' },
      ],
    });
    expect(findExportTemplate('otra')).toBeNull();
  });

  it('normaliza filas y usa matriculados como valor por defecto de activos', () => {
    expect(
      build({
        periodo: '2026-1',
        filas: [
          { programa: '  Artes  ', matriculados: 10 },
          { programa: 'Música', matriculados: 5, activos: 3 },
        ],
      }),
    ).toEqual([
      { programa: 'Artes', matriculados: 10, activos: 10 },
      { programa: 'Música', matriculados: 5, activos: 3 },
    ]);
  });

  it('rechaza parámetros que no son un objeto o carecen de periodo/filas', () => {
    expect(parameterErrorMessage(null)).toContain('objeto');
    expect(parameterErrorMessage([])).toContain('objeto');
    expect(parameterErrorMessage({ filas: [{ programa: 'Artes', matriculados: 1 }] })).toContain(
      'periodo',
    );
    expect(parameterErrorMessage({ periodo: '2026-1', filas: [] })).toContain('filas');
    expect(parameterErrorMessage({ periodo: '2026-1' })).toContain('filas');
  });

  it('rechaza filas mal formadas y contadores inválidos', () => {
    expect(parameterErrorMessage({ periodo: '2026-1', filas: ['x'] })).toContain('no es un objeto');
    expect(parameterErrorMessage({ periodo: '2026-1', filas: [{}] })).toContain('programa');
    expect(
      parameterErrorMessage({ periodo: '2026-1', filas: [{ programa: 'x', matriculados: -1 }] }),
    ).toContain('entero no negativo');
    expect(
      parameterErrorMessage({ periodo: '2026-1', filas: [{ programa: 'x', matriculados: 1.5 }] }),
    ).toContain('entero no negativo');
    expect(
      parameterErrorMessage({
        periodo: '2026-1',
        filas: [{ programa: 'x', matriculados: 1, activos: 2 }],
      }),
    ).toContain('más activos que matriculados');
  });

  it('acota la longitud del periodo y del nombre del programa', () => {
    expect(parameterErrorMessage({ periodo: 'x'.repeat(33), filas: [] })).toContain(
      'demasiado largo',
    );
    expect(
      parameterErrorMessage({
        periodo: '2026-1',
        filas: [{ programa: 'x'.repeat(201), matriculados: 1 }],
      }),
    ).toContain('demasiado largo');
  });
});
