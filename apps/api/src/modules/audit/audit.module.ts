import { Global, Module } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../database/database.module.js';
import type { Database } from '../../database/schema.js';
import { AUDIT_PORT } from '../../shared/audit/audit.port.js';
import { AuditController } from './api/audit.controller.js';
import { AuditService } from './application/audit.service.js';
import { AuditRepository } from './application/ports/audit.repository.js';
import { AuditWriterFactory } from './application/ports/audit-writer.factory.js';
import { KyselyAuditRepository } from './infrastructure/kysely-audit.repository.js';
import { KyselyAuditWriterFactory } from './infrastructure/kysely-audit-writer.factory.js';

@Global()
@Module({
  controllers: [AuditController],
  providers: [
    {
      provide: AuditRepository,
      useFactory: (db: Kysely<Database>) => new KyselyAuditRepository(db),
      inject: [DATABASE],
    },
    { provide: AuditWriterFactory, useClass: KyselyAuditWriterFactory },
    AuditService,
    { provide: AUDIT_PORT, useExisting: AuditService },
  ],
  exports: [AUDIT_PORT, AuditService],
})
export class AuditModule {}
