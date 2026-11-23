import type { AnalyticsFormat, KpiUnit } from '../domain/analytics-definitions.js';

/** Filtro común de ámbito para KPIs y reportes (C6 — D83). */
export interface AnalyticsFilter {
  periodo: string;
  programaId: string | null;
  grupoId: string | null;
  /** null = ámbito global (administrador); id = grupos del educador. */
  educadorId: string | null;
}

export interface AttendanceTotals {
  presentes: number;
  tardes: number;
  total: number;
}

export interface EvaluationTotals {
  excelente: number;
  bueno: number;
  regular: number;
  deficiente: number;
}

export interface ProgramTotals {
  programas: number;
  grupos: number;
}

export interface DropoutTotals {
  retiradas: number;
  base: number;
}

export interface MunicipioCount {
  municipio: string;
  total: number;
}

export interface KpiBreakdownItem {
  clave: string;
  total: number;
}

export interface KpiResult {
  code: string;
  nombre: string;
  valor: number | null;
  unidad: KpiUnit;
  desglose: readonly KpiBreakdownItem[];
  calculadoEn: Date;
}

export interface ReportCatalogItem {
  code: string;
  nombre: string;
  descripcion: string;
  formatos: readonly AnalyticsFormat[];
  columnas: readonly { key: string; label: string }[];
}
