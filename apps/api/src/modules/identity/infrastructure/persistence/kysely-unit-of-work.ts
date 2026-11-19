import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../../../database/database.module.js';
import type { Database } from '../../../../database/schema.js';
import { KyselyAuditWriter } from '../../../../database/audit/kysely-audit.writer.js';
import type { TransactionContext, UnitOfWork } from '../../application/ports/unit-of-work.js';
import { KyselyIdentityRepository } from './kysely-identity.repository.js';
import { KyselySessionRepository } from './kysely-session.repository.js';

@Injectable()
export class KyselyUnitOfWork implements UnitOfWork {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async run<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.db.transaction().execute((trx) =>
      callback({
        identity: new KyselyIdentityRepository(trx),
        sessions: new KyselySessionRepository(trx),
        audit: new KyselyAuditWriter(trx),
      }),
    );
  }
}
