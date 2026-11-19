import type { AuditPort } from '../../../../shared/audit/audit.port.js';
import type { IdentityRepository } from './identity.repository.js';
import type { SessionRepository } from './session.repository.js';

/**
 * Contexto transaccional que comparten los cambios de identidad y su auditoría.
 * El evento se escribe con el mismo ejecutor de base de datos que el cambio;
 * si la inserción falla, la transacción se revierte (AC-AUD-10).
 */
export interface TransactionContext {
  identity: IdentityRepository;
  sessions: SessionRepository;
  audit: AuditPort;
}

export abstract class UnitOfWork {
  abstract run<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
