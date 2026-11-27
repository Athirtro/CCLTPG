import type { AuditPort } from '../../../../shared/audit/audit.port.js';
import type { OutboxPort } from '../../../../shared/events/outbox.port.js';
import type { EmisoraRepository } from './emisora.repository.js';

/**
 * Contexto transaccional de la emisora: repositorio, auditoría y outbox
 * comparten ejecutor para que un evento nunca sobreviva a una reversión.
 */
export interface EmisoraTransactionContext {
  emisora: EmisoraRepository;
  audit: AuditPort;
  outbox: OutboxPort;
}

export abstract class EmisoraUnitOfWork {
  abstract run<T>(callback: (tx: EmisoraTransactionContext) => Promise<T>): Promise<T>;
}
