import { Kysely, PostgresDialect, sql } from 'kysely';
import { NO_MIGRATIONS } from 'kysely/migration';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { KyselyAuditWriter } from '../../src/database/audit/kysely-audit.writer.js';
import { KyselyIdempotencyStore } from '../../src/database/idempotency/kysely-idempotency.store.js';
import { createMigrator } from '../../src/database/migrator/migrator-setup.js';
import type { Database } from '../../src/database/schema.js';
import { seedIdentity } from '../../src/database/seeds/identity.seed.js';
import type { ActorContext } from '../../src/modules/academic/application/academic.types.js';
import type { EvaluacionValor } from '../../src/modules/academic/domain/academic-states.js';
import { AttendanceService } from '../../src/modules/academic/application/attendance.service.js';
import { EnrollmentService } from '../../src/modules/academic/application/enrollment.service.js';
import { EvaluationService } from '../../src/modules/academic/application/evaluation.service.js';
import { GroupService } from '../../src/modules/academic/application/group.service.js';
import { ProgramService } from '../../src/modules/academic/application/program.service.js';
import { SessionService } from '../../src/modules/academic/application/session.service.js';
import { StudentService } from '../../src/modules/academic/application/student.service.js';
import { KyselyUserDirectory } from '../../src/modules/academic/infrastructure/kysely-user-directory.js';
import { SharedPiiCipher } from '../../src/modules/academic/infrastructure/shared-pii-cipher.js';
import { KyselyAcademicUnitOfWork } from '../../src/modules/academic/infrastructure/persistence/kysely-unit-of-work.js';
import { KyselyAttendanceRepository } from '../../src/modules/academic/infrastructure/persistence/kysely-attendance.repository.js';
import { KyselyEnrollmentRepository } from '../../src/modules/academic/infrastructure/persistence/kysely-enrollment.repository.js';
import { KyselyEvaluationRepository } from '../../src/modules/academic/infrastructure/persistence/kysely-evaluation.repository.js';
import { KyselyGroupRepository } from '../../src/modules/academic/infrastructure/persistence/kysely-group.repository.js';
import { KyselyIndicatorRepository } from '../../src/modules/academic/infrastructure/persistence/kysely-indicator.repository.js';
import { KyselyProgramRepository } from '../../src/modules/academic/infrastructure/persistence/kysely-program.repository.js';
import { KyselySessionRepository } from '../../src/modules/academic/infrastructure/persistence/kysely-session.repository.js';
import { KyselyStudentRepository } from '../../src/modules/academic/infrastructure/persistence/kysely-student.repository.js';
import { requireMigratorDatabaseUrl } from '../../src/shared/config/env.js';

const hasDatabase = Boolean(process.env.DATABASE_MIGRATOR_URL);
const SEED_PASSWORD = 'SemillaInicial#2026-test';

describe.runIf(hasDatabase)('Flujos de Académico B contra PostgreSQL (C5 — RB1-38…RB1-41)', () => {
  let db: Kysely<Database>;
  let adminId: string;
  let programService: ProgramService;
  let groupService: GroupService;
  let studentService: StudentService;
  let enrollmentService: EnrollmentService;
  let sessionService: SessionService;
  let attendanceService: AttendanceService;
  let evaluationService: EvaluationService;
  let indicators: KyselyIndicatorRepository;
  let unitOfWork: KyselyAcademicUnitOfWork;

  function actor(overrides: Partial<ActorContext> = {}): ActorContext {
    return {
      userId: adminId,
      actorProfile: 'administrador',
      permissions: [
        'academic:program:manage',
        'academic:group:manage',
        'academic:group:read_own',
        'academic:student:manage',
        'academic:enrollment:create',
        'academic:session:create',
        'academic:session:update',
        'academic:attendance:create',
        'academic:attendance:read',
        'academic:evaluation:create',
        'academic:evaluation:read',
        'academic:evaluation:update',
        'academic:evaluation:read_own',
      ],
      ip: '127.0.0.1',
      userAgent: 'vitest-academic-b',
      requestId: uuidv7(),
      ...overrides,
    };
  }

  const idem = () => `idem-${uuidv7()}`;

  beforeAll(async () => {
    db = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({ connectionString: requireMigratorDatabaseUrl(), max: 6 }),
      }),
    });

    const publicMigrator = createMigrator(db as Kysely<unknown>, 'public');
    const academicMigrator = createMigrator(db as Kysely<unknown>, 'academic');
    await publicMigrator.migrateTo(NO_MIGRATIONS);
    await publicMigrator.migrateToLatest();
    await academicMigrator.migrateTo(NO_MIGRATIONS);
    const migrated = await academicMigrator.migrateToLatest();
    expect(migrated.error).toBeUndefined();

    await seedIdentity(db, { password: SEED_PASSWORD, withTemporaryIdentity: false });
    const admin = await sql<{ id: string }>`
      select id from public.usuario where email = 'admin@ccltpg.org'
    `.execute(db);
    adminId = admin.rows[0].id;

    const programs = new KyselyProgramRepository(db);
    const groups = new KyselyGroupRepository(db);
    const students = new KyselyStudentRepository(db);
    const enrollments = new KyselyEnrollmentRepository(db);
    const sessions = new KyselySessionRepository(db);
    const attendance = new KyselyAttendanceRepository(db);
    indicators = new KyselyIndicatorRepository(db);
    const evaluations = new KyselyEvaluationRepository(db);
    unitOfWork = new KyselyAcademicUnitOfWork(db);
    const idempotency = new KyselyIdempotencyStore(db);
    const pii = new SharedPiiCipher();
    const users = new KyselyUserDirectory(db);

    programService = new ProgramService(programs, unitOfWork, idempotency);
    groupService = new GroupService(groups, programs, unitOfWork, idempotency, users);
    studentService = new StudentService(
      students,
      unitOfWork,
      idempotency,
      pii,
      new KyselyAuditWriter(db),
    );
    enrollmentService = new EnrollmentService(
      enrollments,
      groups,
      students,
      programs,
      unitOfWork,
      idempotency,
    );
    sessionService = new SessionService(sessions, groups, unitOfWork, idempotency);
    attendanceService = new AttendanceService(
      attendance,
      sessions,
      enrollments,
      groups,
      unitOfWork,
    );
    evaluationService = new EvaluationService(
      evaluations,
      enrollments,
      groups,
      indicators,
      unitOfWork,
    );
  }, 60_000);

  afterAll(async () => {
    if (db) {
      const publicMigrator = createMigrator(db as Kysely<unknown>, 'public');
      const academicMigrator = createMigrator(db as Kysely<unknown>, 'academic');
      await publicMigrator.migrateTo(NO_MIGRATIONS);
      await academicMigrator.migrateTo(NO_MIGRATIONS);
      await db.destroy();
    }
  });

  async function prepareFixture(usuarioId: string | null = null) {
    const programa = await programService.create(
      { nombre: `Programa B ${uuidv7()}`, descripcion: null, area: 'musica', cupoMaximo: 5 },
      actor(),
      idem(),
    );
    const grupo = await groupService.create(
      {
        programaId: programa.id,
        codigo: `G-B-${uuidv7().replaceAll('-', '').slice(-12)}`,
        educadorId: adminId,
        salon: 'Sala B',
        periodo: '2026-1',
        cupoMaximo: 5,
      },
      actor(),
      idem(),
    );
    const estudiante = await studentService.create(
      {
        usuarioId,
        tipoDocumento: 'CC',
        numeroDocumento: uuidv7().replaceAll('-', '').slice(-10),
        nombres: 'Ana',
        apellidos: 'Pérez',
        fechaNacimiento: null,
        municipio: null,
        barrio: null,
        direccion: null,
        telefono: null,
        consentimientoDatos: {
          aceptado: true,
          fecha: '2026-01-01',
          versionAviso: 'v1',
        },
      },
      actor(),
      idem(),
    );
    const matricula = await enrollmentService.create(
      { estudianteId: estudiante.id, grupoId: grupo.id, periodo: '2026-1' },
      actor(),
      idem(),
    );
    return { programa, grupo, estudiante, matricula };
  }

  it('crea sesiones con idempotencia, aplica la máquina de estados y oculta el ámbito ajeno', async () => {
    const { grupo } = await prepareFixture();
    const clave = idem();
    const cuerpo = { grupoId: grupo.id, fecha: '2026-09-14', tema: 'Ritmo' };

    await expect(sessionService.create(cuerpo, actor(), null)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
    const sesion = await sessionService.create(cuerpo, actor(), clave);
    expect(sesion.estado).toBe('programada');
    expect(sesion.fecha).toBe('2026-09-14');
    await expect(sessionService.create(cuerpo, actor(), clave)).resolves.toMatchObject({
      id: sesion.id,
    });

    const ajeno = actor({
      userId: uuidv7(),
      permissions: ['academic:group:read_own'],
    });
    await expect(sessionService.get(sesion.id, ajeno)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });

    const realizada = await sessionService.transition(sesion.id, 'realizada', actor());
    expect(realizada.estado).toBe('realizada');
    await expect(sessionService.transition(sesion.id, 'cancelada', actor())).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
  });

  it('registra asistencia de forma idempotente y rechaza matrículas ajenas', async () => {
    const { grupo, matricula } = await prepareFixture();
    const sesion = await sessionService.create(
      { grupoId: grupo.id, fecha: '2026-09-15', tema: null },
      actor(),
      idem(),
    );

    await expect(
      attendanceService.replace(
        sesion.id,
        [{ matriculaId: matricula.id, estado: 'presente' }],
        actor(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });

    await sessionService.transition(sesion.id, 'realizada', actor());
    const primera = await attendanceService.replace(
      sesion.id,
      [{ matriculaId: matricula.id, estado: 'presente' }],
      actor(),
    );
    expect(primera).toHaveLength(1);
    const repetida = await attendanceService.replace(
      sesion.id,
      [{ matriculaId: matricula.id, estado: 'presente' }],
      actor(),
    );
    expect(repetida[0]?.id).toBe(primera[0]?.id);

    const corregida = await attendanceService.replace(
      sesion.id,
      [{ matriculaId: matricula.id, estado: 'ausente' }],
      actor(),
    );
    expect(corregida[0]?.estado).toBe('ausente');
    expect(corregida[0]?.id).not.toBe(primera[0]?.id);

    const otra = await prepareFixture();
    await expect(
      attendanceService.replace(
        sesion.id,
        [{ matriculaId: otra.matricula.id, estado: 'presente' }],
        actor(),
      ),
    ).rejects.toMatchObject({ code: 'ATTENDANCE_INVALID_ENROLLMENT' });

    const auditoria = await sql<{ total: string }>`
      select count(*)::text as total from public.evento_auditoria
      where accion = 'asistencia.registrada' and recurso_id = ${sesion.id}
    `.execute(db);
    // La repetición idéntica no audita: solo el alta y la corrección.
    expect(Number(auditoria.rows[0]?.total)).toBe(2);
  });

  it('valida escala y unicidad de la evaluación, redacta la observación y expone lo propio', async () => {
    const { grupo, matricula } = await prepareFixture(adminId);
    const catalogo = await indicators.listByPrograma(grupo.programaId);
    expect(catalogo.length).toBeGreaterThan(0);
    const indicador = catalogo[0];

    const evaluacion = await evaluationService.create(
      {
        matriculaId: matricula.id,
        indicadorId: indicador.id,
        periodo: '2026-1',
        valor: 'bueno',
        observacion: 'Observación confidencial de la estudiante',
      },
      actor(),
    );
    expect(evaluacion.indicadorNombre).toBe(indicador.nombre);

    await expect(
      evaluationService.create(
        {
          matriculaId: matricula.id,
          indicadorId: indicador.id,
          periodo: '2026-1',
          valor: 'excelente',
          observacion: null,
        },
        actor(),
      ),
    ).rejects.toMatchObject({ code: 'EVALUATION_DUPLICATE' });

    await expect(
      evaluationService.create(
        {
          matriculaId: matricula.id,
          indicadorId: indicador.id,
          periodo: '2026-2',
          valor: 'excelente',
          observacion: null,
        },
        actor(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_PERIOD' });

    await expect(
      evaluationService.create(
        {
          matriculaId: matricula.id,
          indicadorId: indicador.id,
          periodo: '2026-1',
          valor: 'fuera-de-escala' as EvaluacionValor,
          observacion: null,
        },
        actor(),
      ),
    ).rejects.toMatchObject({ code: 'EVALUATION_SCALE_INVALID' });

    const actualizada = await evaluationService.update(
      evaluacion.id,
      { valor: 'excelente', observacion: 'Nueva observación' },
      actor(),
    );
    expect(actualizada.valor).toBe('excelente');

    const propias = await evaluationService.listMine(actor());
    const propia = propias.find((item) => item.id === evaluacion.id);
    expect(propia).toMatchObject({ grupoCodigo: grupo.codigo });

    const filas = await sql<{ datos_despues: unknown }>`
      select datos_despues from public.evento_auditoria
      where recurso = 'evaluacion' and recurso_id = ${evaluacion.id}
      order by ocurrido_en desc
    `.execute(db);
    const serializado = JSON.stringify(filas.rows.map((fila) => fila.datos_despues));
    expect(serializado).not.toContain('Observación confidencial');
    expect(serializado).not.toContain('Nueva observación');
    expect(serializado).toContain('cambiado');
  });
});
