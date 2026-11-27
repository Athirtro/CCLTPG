/**
 * Registro de plantillas de exportación en código (D56, ampliado en C6/D81).
 *
 * El módulo no accede a la base ni a repositorios de dominio: recibe un JSON
 * de entrada ya saneado, lo valida y produce filas. En C6 se añaden cuatro
 * plantillas de reporte alimentadas por el proveedor de datos de analítica;
 * las filas se validan contra las columnas del catálogo compartido.
 */
import { REPORT_DEFINITIONS } from '../../../shared/analytics/analytics-catalog.js';

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
  ...REPORT_DEFINITIONS.map((definition): ExportTemplate => {
    const keys = definition.columnas.map((column) => column.key);
    return {
      codigo: `reporte-${definition.code}`,
      version: 1,
      descripcion: definition.descripcion,
      columns: definition.columnas.map((column) => ({ key: column.key, label: column.label })),
      build: (parametros) => buildReportRows(parametros, keys),
    };
  }),
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
  // Emisora R.A.C. (plan §7): plantillas nuevas y aditivas; el servicio de
  // exportaciones no se modifica y emite `reporte.generado` como siempre.
  ...emisoraTemplates(),
];

/**
 * Plantillas de documentos de emisora. Todas validan un JSON saneado antes de
 * producir filas; el PDF se genera en Exportaciones, nunca en un controlador
 * de emisora.
 */
function emisoraTemplates(): readonly ExportTemplate[] {
  return [
    {
      codigo: 'emisora-oficio-salida',
      version: 1,
      descripcion: 'Oficio de salida en PDF para radicación ante entidades externas.',
      columns: [
        { key: 'destino', label: 'Destino' },
        { key: 'asunto', label: 'Asunto' },
        { key: 'referencia', label: 'Referencia' },
      ],
      build: (parametros) => buildReportRows(parametros, ['destino', 'asunto', 'referencia']),
    },
    {
      codigo: 'emisora-resolucion-incentivos',
      version: 1,
      descripcion: 'Resolución de incentivos de realizadores.',
      columns: [
        { key: 'realizador', label: 'Realizador' },
        { key: 'concepto', label: 'Concepto' },
        { key: 'estado', label: 'Estado' },
      ],
      build: (parametros) => buildReportRows(parametros, ['realizador', 'concepto', 'estado']),
    },
    {
      codigo: 'emisora-formato-programacion',
      version: 1,
      descripcion: 'Formato oficial de programación diaria.',
      columns: [
        { key: 'fecha', label: 'Fecha' },
        { key: 'franja', label: 'Franja' },
        { key: 'programa', label: 'Programa' },
      ],
      build: (parametros) => buildReportRows(parametros, ['fecha', 'franja', 'programa']),
    },
    {
      codigo: 'emisora-rejilla-cuneros',
      version: 1,
      descripcion: 'Rejilla anual Cuneros aprobada por el comité.',
      columns: [
        { key: 'anio', label: 'Año' },
        { key: 'franja', label: 'Franja' },
        { key: 'realizador', label: 'Realizador' },
      ],
      build: (parametros) => buildReportRows(parametros, ['anio', 'franja', 'realizador']),
    },
    {
      codigo: 'emisora-reporte-obras',
      version: 1,
      descripcion: 'Reporte digital de obras para Sayco/Acinpro.',
      columns: [
        { key: 'titulo', label: 'Título' },
        { key: 'compositor', label: 'Compositor o artista' },
        { key: 'duracion', label: 'Duración' },
      ],
      build: (parametros) => buildReportRows(parametros, ['titulo', 'compositor', 'duracion']),
    },
    {
      codigo: 'emisora-planilla-emision',
      version: 1,
      descripcion: 'Planilla de emisión y archivo sonoro.',
      columns: [
        { key: 'fecha', label: 'Fecha' },
        { key: 'programa', label: 'Programa' },
        { key: 'archivo_id', label: 'Archivo' },
      ],
      build: (parametros) => buildReportRows(parametros, ['fecha', 'programa', 'archivo_id']),
    },
  ];
}

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

/** Valida las filas producidas por el proveedor de reportes (C6 — RB1-52). */
function buildReportRows(parametros: unknown, keys: readonly string[]): ExportTemplateRow[] {
  if (!isRecord(parametros)) {
    throw invalid('Los parámetros del reporte deben ser un objeto.');
  }
  if (typeof parametros.periodo !== 'string' || parametros.periodo.length === 0) {
    throw invalid('El parámetro "periodo" del reporte es obligatorio.');
  }
  if (!Array.isArray(parametros.filas)) {
    throw invalid('El parámetro "filas" del reporte debe ser un arreglo.');
  }

  return parametros.filas.map((fila, index) => {
    if (!isRecord(fila)) {
      throw invalid(`La fila ${index + 1} del reporte no es un objeto.`);
    }
    const row: ExportTemplateRow = {};
    for (const key of keys) {
      const value = fila[key];
      if (typeof value !== 'string' && typeof value !== 'number') {
        throw invalid(`La fila ${index + 1} no tiene un valor válido para "${key}".`);
      }
      if (typeof value === 'number' && !Number.isFinite(value)) {
        throw invalid(`La fila ${index + 1} tiene un número no finito en "${key}".`);
      }
      row[key] = value;
    }
    return row;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
