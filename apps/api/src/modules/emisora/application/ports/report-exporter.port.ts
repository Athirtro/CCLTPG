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

export interface ResolucionGenerada {
  archivoId: string;
  nombre: string;
  descargaUrl: string;
}

export interface EmisoraReportExporter {
  generarResolucion(input: GenerarResolucionInput): Promise<ResolucionGenerada>;
}
