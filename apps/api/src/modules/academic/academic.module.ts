import { Module } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../database/database.module.js';
import type { Database } from '../../database/schema.js';
import { AttendanceController } from './api/attendance.controller.js';
import { EnrollmentsController } from './api/enrollments.controller.js';
import { EvaluationsController } from './api/evaluations.controller.js';
import { GroupSessionsController } from './api/group-sessions.controller.js';
import { GroupsController } from './api/groups.controller.js';
import { MeAcademicController } from './api/me-academic.controller.js';
import { ProgramsController } from './api/programs.controller.js';
import { SessionsController } from './api/sessions.controller.js';
import { StudentsController } from './api/students.controller.js';
import { AttendanceService } from './application/attendance.service.js';
import { EnrollmentService } from './application/enrollment.service.js';
import { EvaluationService } from './application/evaluation.service.js';
import { GroupService } from './application/group.service.js';
import { ProgramService } from './application/program.service.js';
import { SessionService } from './application/session.service.js';
import { StudentService } from './application/student.service.js';
import { AttendanceRepository } from './application/ports/attendance.repository.js';
import { EnrollmentRepository } from './application/ports/enrollment.repository.js';
import { EvaluationRepository } from './application/ports/evaluation.repository.js';
import { GroupRepository } from './application/ports/group.repository.js';
import { IndicatorRepository } from './application/ports/indicator.repository.js';
import { PiiCipher } from './application/ports/pii-cipher.js';
import { ProgramRepository } from './application/ports/program.repository.js';
import { SessionRepository } from './application/ports/session.repository.js';
import { StudentRepository } from './application/ports/student.repository.js';
import { AcademicUnitOfWork } from './application/ports/unit-of-work.js';
import { UserDirectory } from './application/ports/user-directory.js';
import { KyselyUserDirectory } from './infrastructure/kysely-user-directory.js';
import { SharedPiiCipher } from './infrastructure/shared-pii-cipher.js';
import { KyselyAttendanceRepository } from './infrastructure/persistence/kysely-attendance.repository.js';
import { KyselyEnrollmentRepository } from './infrastructure/persistence/kysely-enrollment.repository.js';
import { KyselyEvaluationRepository } from './infrastructure/persistence/kysely-evaluation.repository.js';
import { KyselyGroupRepository } from './infrastructure/persistence/kysely-group.repository.js';
import { KyselyIndicatorRepository } from './infrastructure/persistence/kysely-indicator.repository.js';
import { KyselyProgramRepository } from './infrastructure/persistence/kysely-program.repository.js';
import { KyselySessionRepository } from './infrastructure/persistence/kysely-session.repository.js';
import { KyselyStudentRepository } from './infrastructure/persistence/kysely-student.repository.js';
import { KyselyAcademicUnitOfWork } from './infrastructure/persistence/kysely-unit-of-work.js';

/**
 * Contexto académico (C4/C5). Los agregados comparten el espacio de ejecución
 * y se comunican solo por puertos de aplicación; las notificaciones salen por
 * outbox y la identidad se consulta por `UserDirectory`. Catálogo de
 * indicadores sin ruta propia (D73).
 */
@Module({
  controllers: [
    ProgramsController,
    GroupsController,
    GroupSessionsController,
    SessionsController,
    AttendanceController,
    EvaluationsController,
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
    {
      provide: SessionRepository,
      useFactory: (db: Kysely<Database>) => new KyselySessionRepository(db),
      inject: [DATABASE],
    },
    {
      provide: AttendanceRepository,
      useFactory: (db: Kysely<Database>) => new KyselyAttendanceRepository(db),
      inject: [DATABASE],
    },
    {
      provide: IndicatorRepository,
      useFactory: (db: Kysely<Database>) => new KyselyIndicatorRepository(db),
      inject: [DATABASE],
    },
    {
      provide: EvaluationRepository,
      useFactory: (db: Kysely<Database>) => new KyselyEvaluationRepository(db),
      inject: [DATABASE],
    },
    { provide: AcademicUnitOfWork, useClass: KyselyAcademicUnitOfWork },
    { provide: UserDirectory, useClass: KyselyUserDirectory },
    { provide: PiiCipher, useClass: SharedPiiCipher },
    ProgramService,
    GroupService,
    SessionService,
    AttendanceService,
    EvaluationService,
    StudentService,
    EnrollmentService,
  ],
})
export class AcademicModule {}
