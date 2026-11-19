import type { AuditPort } from '../../../../shared/audit/audit.port.js';

/**
 * La aplicación de auditoría no conoce Kysely: pide un escritor y la
 * infraestructura decide el ejecutor (conexión o transacción).
 */
export abstract class AuditWriterFactory {
  abstract create(): AuditPort;
}
