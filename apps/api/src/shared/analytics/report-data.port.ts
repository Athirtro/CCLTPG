/**
 * Datos agregados para los reportes académicos (C6 — D81).
 *
 * El puerto vive en `shared` para que el contexto de exportaciones pueda
 * solicitar filas al proveedor sin importar el contexto de analítica.
 * El proveedor aplica siempre el ámbito en servidor: un educador nunca recibe
 * filas de grupos ajenos, aunque envíe un `grupoId` distinto.
 */
export interface AnalyticsReportFilter {
  periodo: string;
  programaId: string | null;
  grupoId: string | null;
  /** null = administrador; uuid = educador autenticado. */
  educadorId: string | null;
}

export type ReportRow = Record<string, string | number>;

export const REPORT_DATA_PORT = Symbol('CCLTPG_REPORT_DATA_PORT');

export abstract class ReportDataPort {
  abstract rowsFor(code: string, filter: AnalyticsReportFilter): Promise<ReportRow[]>;
  abstract groupBelongsToEducador(grupoId: string, educadorId: string): Promise<boolean>;
}
