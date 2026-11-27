import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { KyselyAuditWriter } from '../../../../database/audit/kysely-audit.writer.js';
import { DATABASE } from '../../../../database/database.module.js';
import { KyselyOutboxWriter } from '../../../../database/events/kysely-outbox.writer.js';
import type { Database } from '../../../../database/schema.js';
import type {
  EmisoraTransactionContext,
  EmisoraUnitOfWork,
} from '../../application/ports/unit-of-work.js';
import { KyselyEmisoraRepository } from './kysely-emisora.repository.js';

@Injectable()
export class KyselyEmisoraUnitOfWork implements EmisoraUnitOfWork {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async run<T>(callback: (tx: EmisoraTransactionContext) => Promise<T>): Promise<T> {
    return this.db.transaction().execute((trx) =>
      callback({
        emisora: new KyselyEmisoraRepository(trx),
        audit: new KyselyAuditWriter(trx),
        outbox: new KyselyOutboxWriter(trx),
      }),
    );
  }
}
