import { Module } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../database/database.module.js';
import type { Database } from '../../database/schema.js';
import { EnrollmentsController } from './api/enrollments.controller.js';
import { GroupsController } from './api/groups.controller.js';
import { MeAcademicController } from './api/me-academic.controller.js';
import { ProgramsController } from './api/programs.controller.js';
import { StudentsController } from './api/students.controller.js';
import { EnrollmentService } from './application/enrollment.service.js';
import { GroupService } from './application/group.service.js';
import { ProgramService } from './application/program.service.js';
import { StudentService } from './application/student.service.js';
import { EnrollmentRepository } from './application/ports/enrollment.repository.js';
import { GroupRepository } from './application/ports/group.repository.js';
import { PiiCipher } from './application/ports/pii-cipher.js';
import { ProgramRepository } from './application/ports/program.repository.js';
import { StudentRepository } from './application/ports/student.repository.js';
import { AcademicUnitOfWork } from './application/ports/unit-of-work.js';
import { UserDirectory } from './application/ports/user-directory.js';
import { KyselyUserDirectory } from './infrastructure/kysely-user-directory.js';
import { SharedPiiCipher } from './infrastructure/shared-pii-cipher.js';
import { KyselyEnrollmentRepository } from './infrastructure/persistence/kysely-enrollment.repository.js';
import { KyselyGroupRepository } from './infrastructure/persistence/kysely-group.repository.js';
import { KyselyProgramRepository } from './infrastructure/persistence/kysely-program.repository.js';
import { KyselyStudentRepository } from './infrastructure/persistence/kysely-student.repository.js';
import { KyselyAcademicUnitOfWork } from './infrastructure/persistence/kysely-unit-of-work.js';

/**
 * Contexto académico (C4). Los agregados comparten el espacio de ejecución y
 * se comunican solo por puertos de aplicación; las notificaciones salen por
 * outbox y la identidad se consulta por `UserDirectory`.
 */
@Module({
  controllers: [
    ProgramsController,
    GroupsController,
    StudentsController,
    EnrollmentsController,
    MeAcademicController,
  ],
  providers: [
    {
      provide: ProgramRepository,
      useFactory: (db: Kysely<Database>) => new KyselyProgramRepository(db),
      inject: [DATABASE],
    },
    {
      provide: GroupRepository,
      useFactory: (db: Kysely<Database>) => new KyselyGroupRepository(db),
      inject: [DATABASE],
    },
    {
      provide: StudentRepository,
      useFactory: (db: Kysely<Database>) => new KyselyStudentRepository(db),
      inject: [DATABASE],
    },
    {
      provide: EnrollmentRepository,
      useFactory: (db: Kysely<Database>) => new KyselyEnrollmentRepository(db),
      inject: [DATABASE],
    },
    { provide: AcademicUnitOfWork, useClass: KyselyAcademicUnitOfWork },
    { provide: UserDirectory, useClass: KyselyUserDirectory },
    { provide: PiiCipher, useClass: SharedPiiCipher },
    ProgramService,
    GroupService,
    StudentService,
    EnrollmentService,
  ],
})
export class AcademicModule {}
