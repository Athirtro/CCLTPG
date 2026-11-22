import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../../../database/database.module.js';
import { KyselyAuditWriter } from '../../../../database/audit/kysely-audit.writer.js';
import { KyselyOutboxWriter } from '../../../../database/events/kysely-outbox.writer.js';
import type { Database } from '../../../../database/schema.js';
import type {
  FilesTransactionContext,
  FilesUnitOfWork,
} from '../../application/ports/unit-of-work.js';
import { KyselyFileRepository } from './kysely-file.repository.js';

@Injectable()
export class KyselyFilesUnitOfWork implements FilesUnitOfWork {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async run<T>(callback: (tx: FilesTransactionContext) => Promise<T>): Promise<T> {
    return this.db.transaction().execute((trx) =>
      callback({
        files: new KyselyFileRepository(trx),
        audit: new KyselyAuditWriter(trx),
        outbox: new KyselyOutboxWriter(trx),
      }),
    );
  }
}
