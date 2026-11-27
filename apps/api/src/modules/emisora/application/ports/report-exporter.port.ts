import type { ActorContext } from '../emisora.types.js';

/**
 * Puerto de Exportaciones consumido por RF-03.7 (plan §19.2).
 *
 * Emisora declara el contrato que necesita; la implementación vive en
 * `src/integration/` y delega en el contexto dueño de las plantillas. Así se
 * respeta la regla de arquitectura que prohíbe importar otro contexto desde
 * `modules/emisora`.
 */
export const EMISORA_REPORT_EXPORTER = Symbol('CCLTPG_EMISORA_REPORT_EXPORTER');

export interface FilaResolucion {
  realizador: string;
  concepto: string;
  estado: string;
}

export interface GenerarResolucionInput {
  periodo: string;
  filas: readonly FilaResolucion[];
  idempotencyKey: string;
  actor: ActorContext;
}

export interface DocumentoGenerado {
  archivoId: string;
  nombre: string;
  descargaUrl: string;
}

/** Compatibilidad con E3: la resolución es un documento generado más. */
export type ResolucionGenerada = DocumentoGenerado;

export interface GenerarReporteObrasInput {
  entidad: string;
  periodo: string;
  filas: readonly { titulo: string; compositor: string; duracion: string }[];
  idempotencyKey: string;
  actor: ActorContext;
}

export interface GenerarOficioInput {
  destino: string;
  asunto: string;
  referencia: string;
  idempotencyKey: string;
  actor: ActorContext;
}

export interface GenerarPlanillaInput {
  fecha: string;
  programa: string;
  archivoId: string;
  idempotencyKey: string;
  actor: ActorContext;
}

export interface EmisoraReportExporter {
  generarResolucion(input: GenerarResolucionInput): Promise<DocumentoGenerado>;
  generarReporteObras(input: GenerarReporteObrasInput): Promise<DocumentoGenerado>;
  generarOficioSalida(input: GenerarOficioInput): Promise<DocumentoGenerado>;
  generarPlanilla(input: GenerarPlanillaInput): Promise<DocumentoGenerado>;
}
