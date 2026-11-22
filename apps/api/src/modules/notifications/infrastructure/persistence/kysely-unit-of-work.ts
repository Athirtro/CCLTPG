import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../../../database/database.module.js';
import { KyselyAuditWriter } from '../../../../database/audit/kysely-audit.writer.js';
import type { Database } from '../../../../database/schema.js';
import type {
  NotificationsTransactionContext,
  NotificationsUnitOfWork,
} from '../../application/ports/unit-of-work.js';
import { KyselyNotificationRepository } from './kysely-notification.repository.js';

@Injectable()
export class KyselyNotificationsUnitOfWork implements NotificationsUnitOfWork {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async run<T>(callback: (tx: NotificationsTransactionContext) => Promise<T>): Promise<T> {
    return this.db.transaction().execute((trx) =>
      callback({
        notifications: new KyselyNotificationRepository(trx),
        audit: new KyselyAuditWriter(trx),
      }),
    );
  }
}
