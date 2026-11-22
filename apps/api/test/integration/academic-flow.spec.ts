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
import { EnrollmentService } from '../../src/modules/academic/application/enrollment.service.js';
import { GroupService } from '../../src/modules/academic/application/group.service.js';
import { ProgramService } from '../../src/modules/academic/application/program.service.js';
import { StudentService } from '../../src/modules/academic/application/student.service.js';
import { KyselyUserDirectory } from '../../src/modules/academic/infrastructure/kysely-user-directory.js';
import { SharedPiiCipher } from '../../src/modules/academic/infrastructure/shared-pii-cipher.js';
import { KyselyAcademicUnitOfWork } from '../../src/modules/academic/infrastructure/persistence/kysely-unit-of-work.js';
import { KyselyEnrollmentRepository } from '../../src/modules/academic/infrastructure/persistence/kysely-enrollment.repository.js';
import { KyselyGroupRepository } from '../../src/modules/academic/infrastructure/persistence/kysely-group.repository.js';
import { KyselyProgramRepository } from '../../src/modules/academic/infrastructure/persistence/kysely-program.repository.js';
import { KyselyStudentRepository } from '../../src/modules/academic/infrastructure/persistence/kysely-student.repository.js';
import { requireMigratorDatabaseUrl } from '../../src/shared/config/env.js';

const hasDatabase = Boolean(process.env.DATABASE_MIGRATOR_URL);
const SEED_PASSWORD = 'SemillaInicial#2026-test';

describe.runIf(hasDatabase)('Flujos académicos contra PostgreSQL (C4 — RB1-28…RB1-36)', () => {
  let db: Kysely<Database>;
  let programs: KyselyProgramRepository;
  let groups: KyselyGroupRepository;
  let programService: ProgramService;
  let groupService: GroupService;
  let studentService: StudentService;
  let enrollmentService: EnrollmentService;
  let adminId: string;

  function actor(overrides: Partial<ActorContext> = {}): ActorContext {
    return {
      userId: adminId,
      actorProfile: 'administrador',
      permissions: [
        'academic:program:manage',
        'academic:group:manage',
        'academic:student:manage',
        'academic:enrollment:create',
        'academic:enrollment:update',
        'academic:schedule:read',
      ],
      ip: '127.0.0.1',
      userAgent: 'vitest-academic',
      requestId: uuidv7(),
      ...overrides,
    };
  }

  async function createProgram(nombre: string, cupoMaximo = 5) {
    return programService.create(
      { nombre, descripcion: null, area: 'danza', cupoMaximo },
      actor(),
      `idem-${uuidv7()}`,
    );
  }

  async function createGroup(
    programaId: string,
    codigo: string,
    periodo = '2026-1',
    salon = 'Sala A',
    cupoMaximo = 5,
  ) {
    return groupService.create(
      { programaId, codigo, educadorId: adminId, salon, periodo, cupoMaximo },
      actor(),
      `idem-${uuidv7()}`,
    );
  }

  async function createStudent(documento: string, usuarioId: string | null = null) {
    return studentService.create(
      {
        usuarioId,
        tipoDocumento: 'CC',
        numeroDocumento: documento,
        nombres: 'Ana',
        apellidos: 'Pérez',
        fechaNacimiento: null,
        municipio: null,
        barrio: null,
        direccion: 'Calle 1 # 2-3',
        telefono: '3001234567',
        consentimientoDatos: {
          aceptado: true,
          fecha: '2026-01-01',
          versionAviso: 'v1',
        },
      },
      actor(),
      `idem-${uuidv7()}`,
    );
  }

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

    programs = new KyselyProgramRepository(db);
    groups = new KyselyGroupRepository(db);
    const students = new KyselyStudentRepository(db);
    const enrollments = new KyselyEnrollmentRepository(db);
    const unitOfWork = new KyselyAcademicUnitOfWork(db);
    const idempotency = new KyselyIdempotencyStore(db);
    const pii = new SharedPiiCipher();
    const users = new KyselyUserDirectory(db);
    const audit = new KyselyAuditWriter(db);

    programService = new ProgramService(programs, unitOfWork, idempotency);
    groupService = new GroupService(groups, programs, unitOfWork, idempotency, users);
    studentService = new StudentService(students, unitOfWork, idempotency, pii, audit);
    enrollmentService = new EnrollmentService(
      enrollments,
      groups,
      students,
      programs,
      unitOfWork,
      idempotency,
    );
  }, 60_000);

  afterAll(async () => {
    if (db) {
      // Cada archivo de integración comparte la misma base: se deja sin
      // migraciones para que los fixtures del migrador puedan aplicar las suyas.
      const publicMigrator = createMigrator(db as Kysely<unknown>, 'public');
      const academicMigrator = createMigrator(db as Kysely<unknown>, 'academic');
      await publicMigrator.migrateTo(NO_MIGRATIONS);
      await academicMigrator.migrateTo(NO_MIGRATIONS);
      await db.destroy();
    }
  });

  it('cifra la PII en reposo y expone el documento solo en la ficha', async () => {
    const estudiante = await createStudent('1122334455');
    const stored = await sql<{
      numero_documento: string;
      numero_documento_hash: string;
      direccion: string | null;
      telefono: string | null;
    }>`
      select numero_documento, numero_documento_hash, direccion, telefono
      from academic.estudiante where id = ${estudiante.id}
    `.execute(db);

    const row = stored.rows[0];
    expect(row.numero_documento.startsWith('v1.')).toBe(true);
    expect(row.numero_documento).not.toContain('1122334455');
    expect(row.numero_documento_hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(row.direccion).not.toContain('Calle 1');
    expect(row.telefono).not.toContain('3001234567');
    expect(estudiante.numeroDocumento).toBe('1122334455');
    expect(estudiante.direccion).toBe('Calle 1 # 2-3');
  });

  it('rechaza documentos duplicados por índice ciego', async () => {
    await createStudent('2233445566');
    await expect(createStudent('2233445566')).rejects.toMatchObject({
      code: 'STUDENT_DUPLICATE',
    });
  });

  it('aplica las máquinas de estado de programa y grupo', async () => {
    const programa = await createProgram('Programa estados', 3);
    expect(programa.estado).toBe('borrador');
    await expect(
      programService.transition(programa.id, 'archivado', actor()),
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });

    const publicado = await programService.transition(programa.id, 'publicado', actor());
    expect(publicado.estado).toBe('publicado');
    const archivado = await programService.transition(programa.id, 'archivado', actor());
    expect(archivado.estado).toBe('archivado');

    const grupo = await createGroup(programa.id, 'G-ESTADOS');
    expect(grupo.estado).toBe('abierto');
    const cerrado = await groupService.transition(grupo.id, 'cerrado', actor());
    expect(cerrado.estado).toBe('cerrado');
  });

  it('rechaza matrículas vigentes duplicadas y resuelve el cupo concurrente', async () => {
    const programa = await createProgram('Programa cupo', 1);
    const grupo = await createGroup(programa.id, 'G-CUPO', '2026-1', 'Sala Cupo', 1);
    const uno = await createStudent('3344556677');
    const dos = await createStudent('4455667788');

    const primera = await enrollmentService.create(
      { estudianteId: uno.id, grupoId: grupo.id, periodo: '2026-1' },
      actor(),
      `idem-${uuidv7()}`,
    );
    const segunda = await enrollmentService.create(
      { estudianteId: dos.id, grupoId: grupo.id, periodo: '2026-1' },
      actor(),
      `idem-${uuidv7()}`,
    );
    expect(primera.estado).toBe('preinscrita');

    await expect(
      enrollmentService.create(
        { estudianteId: uno.id, grupoId: grupo.id, periodo: '2026-1' },
        actor(),
        `idem-${uuidv7()}`,
      ),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_DUPLICATE' });

    const resultados = await Promise.allSettled([
      enrollmentService.transition(primera.id, 'confirmada', actor()),
      enrollmentService.transition(segunda.id, 'confirmada', actor()),
    ]);
    expect(resultados.filter((resultado) => resultado.status === 'fulfilled')).toHaveLength(1);
    const rechazos = resultados.filter(
      (resultado): resultado is PromiseRejectedResult => resultado.status === 'rejected',
    );
    expect(rechazos).toHaveLength(1);
    expect(rechazos[0]?.reason).toMatchObject({ code: 'GROUP_CAPACITY_EXCEEDED' });
  });

  it('encadena estados de matrícula y publica notificaciones por outbox', async () => {
    const programa = await createProgram('Programa matrículas', 5);
    const grupo = await createGroup(programa.id, 'G-MAT', '2026-1', 'Sala Mat');
    const estudiante = await createStudent('5566778899');
    const matricula = await enrollmentService.create(
      { estudianteId: estudiante.id, grupoId: grupo.id, periodo: '2026-1' },
      actor(),
      `idem-${uuidv7()}`,
    );

    await expect(
      enrollmentService.transition(matricula.id, 'finalizada', actor()),
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });

    const confirmada = await enrollmentService.transition(matricula.id, 'confirmada', actor());
    expect(confirmada.estado).toBe('confirmada');
    const activa = await enrollmentService.transition(matricula.id, 'activa', actor());
    expect(activa.estado).toBe('activa');
    const finalizada = await enrollmentService.transition(matricula.id, 'finalizada', actor());
    expect(finalizada.estado).toBe('finalizada');

    const eventos = await sql<{ tipo: string; total: string }>`
      select tipo, count(*)::text as total
      from public.evento_outbox
      where agregado = 'matricula' and tipo in (
        'matricula.creada', 'matricula.confirmada', 'matricula.activada', 'matricula.finalizada'
      )
      group by tipo order by tipo
    `.execute(db);
    expect(eventos.rows.map((row) => row.tipo)).toEqual([
      'matricula.activada',
      'matricula.confirmada',
      'matricula.creada',
      'matricula.finalizada',
    ]);
  });

  it('reemplaza el horario de forma atómica y bloquea solapamientos', async () => {
    const programa = await createProgram('Programa horario', 5);
    const primero = await createGroup(programa.id, 'G-H1', '2026-2', 'Sala Horario');
    const segundo = await createGroup(programa.id, 'G-H2', '2026-2', 'Sala Horario');

    await groupService.replaceSchedule(
      primero.id,
      [{ diaSemana: 1, horaInicio: '08:00', horaFin: '10:00' }],
      actor(),
    );

    await expect(
      groupService.replaceSchedule(
        segundo.id,
        [{ diaSemana: 1, horaInicio: '09:00', horaFin: '11:00' }],
        actor(),
      ),
    ).rejects.toMatchObject({ code: 'SCHEDULE_OVERLAP' });

    await expect(
      groupService.replaceSchedule(
        segundo.id,
        [{ diaSemana: 1, horaInicio: '10:00', horaFin: '09:00' }],
        actor(),
      ),
    ).rejects.toMatchObject({ code: 'SCHEDULE_INVALID_RANGE' });

    await expect(
      groupService.replaceSchedule(
        segundo.id,
        [
          { diaSemana: 1, horaInicio: '08:00', horaFin: '11:00' },
          { diaSemana: 1, horaInicio: '10:30', horaFin: '12:00' },
        ],
        actor(),
      ),
    ).rejects.toMatchObject({ code: 'SCHEDULE_OVERLAP' });

    const reemplazo = await groupService.replaceSchedule(
      primero.id,
      [{ diaSemana: 2, horaInicio: '14:00', horaFin: '16:00' }],
      actor(),
    );
    expect(reemplazo).toHaveLength(1);
    expect(reemplazo[0]?.diaSemana).toBe(2);
    await expect(groups.findSchedule(primero.id)).resolves.toHaveLength(1);

    const horario = await sql<{ total: string }>`
      select count(*)::text as total from public.evento_outbox where tipo = 'horario.modificado'
    `.execute(db);
    expect(Number(horario.rows[0]?.total)).toBeGreaterThan(0);
  });

  it('expone las vistas propias y audita el listado de estudiantes', async () => {
    const estudiante = await createStudent('6677889900', adminId);
    const propio = await studentService.getMine(actor());
    expect(propio.id).toBe(estudiante.id);
    expect(propio.numeroDocumento).toBe('6677889900');

    await expect(studentService.getMine(actor({ userId: uuidv7() }))).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });

    const listado = await studentService.list({ page: 1, pageSize: 10 }, actor());
    expect(listado.total).toBeGreaterThan(0);
    expect(listado.data[0]).not.toHaveProperty('numeroDocumento');

    const auditoria = await sql<{ total: string }>`
      select count(*)::text as total from public.evento_auditoria
      where accion = 'estudiante.listado' and actor_id = ${adminId}
    `.execute(db);
    expect(Number(auditoria.rows[0]?.total)).toBeGreaterThan(0);
  });

  it('exige idempotencia y devuelve la misma respuesta en repeticiones exactas', async () => {
    const cuerpo = {
      nombre: 'Programa idempotente',
      descripcion: null,
      area: 'teatro' as const,
      cupoMaximo: 2,
    };
    const clave = `idem-${uuidv7()}`;

    await expect(programService.create(cuerpo, actor(), null)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });

    const primero = await programService.create(cuerpo, actor(), clave);
    const repetido = await programService.create(cuerpo, actor(), clave);
    expect(repetido.id).toBe(primero.id);

    await expect(
      programService.create({ ...cuerpo, nombre: 'Programa distinto' }, actor(), clave),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });
});
