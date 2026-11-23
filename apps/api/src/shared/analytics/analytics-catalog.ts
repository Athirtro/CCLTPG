/**
 * Catálogo cerrado de reportes y KPIs de C6 (D81/D82).
 *
 * Vive en `shared` para que los contextos de analítica y exportaciones lo
 * consuman sin importarse entre sí (C-34). Las definiciones están en código:
 * no hay migración ni tabla nueva. Cada KPI declara su fórmula para que la
 * verificación manual de RB1-59 pueda compararla con una consulta directa.
 */

export const ANALYTICS_FORMATS = ['pdf', 'xlsx', 'csv'] as const;
export type AnalyticsFormat = (typeof ANALYTICS_FORMATS)[number];

export const REPORT_CODES = ['asistencia', 'desempeno', 'matricula', 'desercion'] as const;
export type ReportCode = (typeof REPORT_CODES)[number];

export const KPI_CODES = [
  'matricula_activa',
  'asistencia',
  'evaluacion',
  'programas',
  'desercion',
  'distribucion_geografica',
] as const;
export type KpiCode = (typeof KPI_CODES)[number];

export type KpiUnit = 'conteo' | 'porcentaje' | 'distribucion';

export interface KpiDefinition {
  code: KpiCode;
  nombre: string;
  descripcion: string;
  unidad: KpiUnit;
  formula: string;
}

/** Umbral de supresión para agregados derivados de PII (D84). */
export const MIN_KPI_CELL_SIZE = 5;

export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  {
    code: 'matricula_activa',
    nombre: 'Matrícula activa',
    descripcion: 'Matrículas vigentes en el periodo, programa o grupo consultado.',
    unidad: 'conteo',
    formula:
      'COUNT(matricula) donde estado IN (preinscrita, confirmada, activa) y periodo = filtro.',
  },
  {
    code: 'asistencia',
    nombre: 'Asistencia',
    descripcion: 'Porcentaje de registros asistidos en sesiones realizadas.',
    unidad: 'porcentaje',
    formula:
      '100 * (COUNT(estado IN (presente, tarde)) / COUNT(asistencia)) sobre sesiones realizadas del periodo.',
  },
  {
    code: 'evaluacion',
    nombre: 'Evaluación',
    descripcion: 'Porcentaje satisfactorio y distribución por escala cerrada.',
    unidad: 'porcentaje',
    formula:
      '100 * (COUNT(valor IN (excelente, bueno)) / COUNT(evaluacion)) del periodo; distribución por los cuatro valores.',
  },
  {
    code: 'programas',
    nombre: 'Programas',
    descripcion: 'Programas publicados y grupos abiertos del periodo.',
    unidad: 'conteo',
    formula: 'COUNT(programa donde estado = publicado) y COUNT(grupo donde estado = abierto).',
  },
  {
    code: 'desercion',
    nombre: 'Deserción',
    descripcion: 'Porcentaje de matrículas retiradas sobre la base del periodo.',
    unidad: 'porcentaje',
    formula: '100 * COUNT(retirada) / COUNT(estado IN (activa, finalizada, retirada)) del periodo.',
  },
  {
    code: 'distribucion_geografica',
    nombre: 'Distribución geográfica',
    descripcion: 'Estudiantes vigentes agrupados por municipio, sin PII individual.',
    unidad: 'distribucion',
    formula:
      'COUNT(distinto estudiante) por municipio sobre matrículas vigentes; celdas con menos de 5 se omiten.',
  },
];

export interface ExportColumnDefinition {
  key: string;
  label: string;
}

export interface ReportDefinition {
  code: ReportCode;
  nombre: string;
  descripcion: string;
  formatos: readonly AnalyticsFormat[];
  columnas: readonly ExportColumnDefinition[];
}

export const REPORT_DEFINITIONS: readonly ReportDefinition[] = [
  {
    code: 'asistencia',
    nombre: 'Reporte de asistencia',
    descripcion: 'Asistencia por sesión, grupo y estudiante.',
    formatos: ANALYTICS_FORMATS,
    columnas: [
      { key: 'grupo', label: 'Grupo' },
      { key: 'sesion', label: 'Sesión' },
      { key: 'estudiante', label: 'Estudiante' },
      { key: 'estado', label: 'Estado' },
    ],
  },
  {
    code: 'desempeno',
    nombre: 'Reporte de desempeño',
    descripcion: 'Evaluaciones cualitativas por indicador y escala.',
    formatos: ANALYTICS_FORMATS,
    columnas: [
      { key: 'grupo', label: 'Grupo' },
      { key: 'indicador', label: 'Indicador' },
      { key: 'estudiante', label: 'Estudiante' },
      { key: 'valor', label: 'Valor' },
    ],
  },
  {
    code: 'matricula',
    nombre: 'Reporte de matrícula',
    descripcion: 'Matrículas por programa, grupo y estado.',
    formatos: ANALYTICS_FORMATS,
    columnas: [
      { key: 'programa', label: 'Programa' },
      { key: 'grupo', label: 'Grupo' },
      { key: 'estado', label: 'Estado' },
      { key: 'total', label: 'Total' },
    ],
  },
  {
    code: 'desercion',
    nombre: 'Reporte de deserción',
    descripcion: 'Retiros y cancelaciones por periodo y grupo.',
    formatos: ANALYTICS_FORMATS,
    columnas: [
      { key: 'periodo', label: 'Periodo' },
      { key: 'grupo', label: 'Grupo' },
      { key: 'retiradas', label: 'Retiradas' },
      { key: 'porcentaje', label: 'Porcentaje' },
    ],
  },
];

export function findKpi(code: string): KpiDefinition | null {
  return KPI_DEFINITIONS.find((definition) => definition.code === code) ?? null;
}

export function findReport(code: string): ReportDefinition | null {
  return REPORT_DEFINITIONS.find((definition) => definition.code === code) ?? null;
}
