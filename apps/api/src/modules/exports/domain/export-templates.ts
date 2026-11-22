/**
 * Registro de plantillas de exportación en código (D56).
 *
 * El módulo no accede a la base ni a repositorios de dominio: recibe un JSON
 * de entrada ya saneado, lo valida y produce filas. Los reportes académicos
 * reales llegan en C6; esta plantilla es la muestra de compuerta.
 */

export const EXPORT_FORMATS = ['pdf', 'xlsx', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportColumn {
  key: string;
  label: string;
}

export interface ExportTemplateRow {
  [key: string]: string | number;
}

export interface ExportTemplate {
  codigo: string;
  version: number;
  descripcion: string;
  columns: readonly ExportColumn[];
  build(parametros: unknown): ExportTemplateRow[];
}

const MAX_PROGRAM_LENGTH = 200;
const MAX_PERIOD_LENGTH = 32;

export const EXPORT_TEMPLATES: readonly ExportTemplate[] = [
  {
    codigo: 'matriculas-por-programa',
    version: 1,
    descripcion: 'Resumen de matrículas por programa con datos de muestra.',
    columns: [
      { key: 'programa', label: 'Programa' },
      { key: 'matriculados', label: 'Matriculados' },
      { key: 'activos', label: 'Activos' },
    ],
    build: buildEnrollmentSummary,
  },
];

export function findExportTemplate(codigo: string): ExportTemplate | null {
  return EXPORT_TEMPLATES.find((template) => template.codigo === codigo) ?? null;
}

function buildEnrollmentSummary(parametros: unknown): ExportTemplateRow[] {
  if (!isRecord(parametros)) {
    throw invalid('Los parámetros deben ser un objeto.');
  }

  const periodo = parametros.periodo;
  if (typeof periodo !== 'string' || periodo.trim().length === 0) {
    throw invalid('El parámetro "periodo" es obligatorio.');
  }
  if (periodo.length > MAX_PERIOD_LENGTH) {
    throw invalid('El parámetro "periodo" es demasiado largo.');
  }

  const filas = parametros.filas;
  if (!Array.isArray(filas) || filas.length === 0) {
    throw invalid('El parámetro "filas" debe ser un arreglo no vacío.');
  }

  return filas.map((fila, index) => {
    if (!isRecord(fila)) {
      throw invalid(`La fila ${index + 1} no es un objeto.`);
    }

    const programa = fila.programa;
    if (typeof programa !== 'string' || programa.trim().length === 0) {
      throw invalid(`La fila ${index + 1} no tiene "programa".`);
    }
    if (programa.length > MAX_PROGRAM_LENGTH) {
      throw invalid(`El programa de la fila ${index + 1} es demasiado largo.`);
    }

    const matriculados = integerOf(fila.matriculados, `fila ${index + 1}: matriculados`);
    const activos =
      fila.activos === undefined
        ? matriculados
        : integerOf(fila.activos, `fila ${index + 1}: activos`);

    if (activos > matriculados) {
      throw invalid(`La fila ${index + 1} tiene más activos que matriculados.`);
    }

    return { programa: programa.trim(), matriculados, activos };
  });
}

class ExportTemplateParameterError extends Error {}

function invalid(detail: string): ExportTemplateParameterError {
  return new ExportTemplateParameterError(detail);
}

export function isExportTemplateParameterError(
  error: unknown,
): error is ExportTemplateParameterError {
  return error instanceof ExportTemplateParameterError;
}

function integerOf(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw invalid(`El campo "${field}" debe ser un entero no negativo.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
