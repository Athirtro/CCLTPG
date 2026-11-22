import type { AuditPort } from '../../../../shared/audit/audit.port.js';
import type { OutboxPort } from '../../../../shared/events/outbox.port.js';
import type { ExportFileRepository } from './export-file.repository.js';

export interface ExportsTransactionContext {
  files: ExportFileRepository;
  audit: AuditPort;
  outbox: OutboxPort;
}

export abstract class ExportsUnitOfWork {
  abstract run<T>(callback: (tx: ExportsTransactionContext) => Promise<T>): Promise<T>;
}
