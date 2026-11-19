import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../../database/database.module.js';
import { KyselyAuditWriter } from '../../../database/audit/kysely-audit.writer.js';
import type { Database } from '../../../database/schema.js';
import type { AuditPort } from '../../../shared/audit/audit.port.js';
import { AuditWriterFactory } from '../application/ports/audit-writer.factory.js';

@Injectable()
export class KyselyAuditWriterFactory implements AuditWriterFactory {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  create(): AuditPort {
    return new KyselyAuditWriter(this.db);
  }
}
