import type { AuditPort } from '../../../../shared/audit/audit.port.js';
import type { NotificationRepository } from './notification.repository.js';

export interface NotificationsTransactionContext {
  notifications: NotificationRepository;
  audit: AuditPort;
}

export abstract class NotificationsUnitOfWork {
  abstract run<T>(callback: (tx: NotificationsTransactionContext) => Promise<T>): Promise<T>;
}
