import type { AuditPort } from '../../../../shared/audit/audit.port.js';
import type { OutboxPort } from '../../../../shared/events/outbox.port.js';
import type { FileRepository } from './file.repository.js';

/**
 * Contexto transaccional de archivos: metadatos, auditoría y evento de salida
 * se confirman o revierten juntos.
 */
export interface FilesTransactionContext {
  files: FileRepository;
  audit: AuditPort;
  outbox: OutboxPort;
}

export abstract class FilesUnitOfWork {
  abstract run<T>(callback: (tx: FilesTransactionContext) => Promise<T>): Promise<T>;
}
