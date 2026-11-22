import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../../../database/database.module.js';
import { KyselyAuditWriter } from '../../../../database/audit/kysely-audit.writer.js';
import { KyselyOutboxWriter } from '../../../../database/events/kysely-outbox.writer.js';
import type { Database } from '../../../../database/schema.js';
import type {
  AcademicTransactionContext,
  AcademicUnitOfWork,
} from '../../application/ports/unit-of-work.js';
import { KyselyEnrollmentRepository } from './kysely-enrollment.repository.js';
import { KyselyGroupRepository } from './kysely-group.repository.js';
import { KyselyProgramRepository } from './kysely-program.repository.js';
import { KyselyStudentRepository } from './kysely-student.repository.js';

@Injectable()
export class KyselyAcademicUnitOfWork implements AcademicUnitOfWork {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async run<T>(callback: (tx: AcademicTransactionContext) => Promise<T>): Promise<T> {
    return this.db.transaction().execute((trx) =>
      callback({
        programs: new KyselyProgramRepository(trx),
        groups: new KyselyGroupRepository(trx),
        students: new KyselyStudentRepository(trx),
        enrollments: new KyselyEnrollmentRepository(trx),
        audit: new KyselyAuditWriter(trx),
        outbox: new KyselyOutboxWriter(trx),
      }),
    );
  }
}
