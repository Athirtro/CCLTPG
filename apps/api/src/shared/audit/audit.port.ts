/**
 * Puerto de auditoría.
 *
 * El contexto de identidad (y cualquier otro) depende de esta interfaz, nunca
 * de la implementación del contexto de auditoría. Así se respeta el aislamiento
 * entre contextos del monolito modular (C-34) y la auditoría se escribe en la
 * misma transacción que el cambio (AC-AUD-10).
 */

export const AUDIT_PORT = Symbol('CCLTPG_AUDIT_PORT');

export interface AuditEvent {
  accion: string;
  recurso: string;
  recursoId?: string | null;
  actorId?: string | null;
  actorPerfil?: string | null;
  ip?: string | null;
  dispositivo?: string | null;
  datosAntes?: unknown;
  datosDespues?: unknown;
  requestId?: string | null;
  ocurridoEn?: Date;
}

export interface AuditPort {
  record(event: AuditEvent): Promise<void>;
}
