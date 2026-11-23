import { Kysely, PostgresDialect, sql } from 'kysely';
import { NO_MIGRATIONS } from 'kysely/migration';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { KyselyReportDataProvider } from '../../src/database/analytics/kysely-report-data.provider.js';
import { KyselyAuditWriter } from '../../src/database/audit/kysely-audit.writer.js';
import { KyselyIdempotencyStore } from '../../src/database/idempotency/kysely-idempotency.store.js';
import { createMigrator } from '../../src/database/migrator/migrator-setup.js';
import type { Database } from '../../src/database/schema.js';
import { seedIdentity } from '../../src/database/seeds/identity.seed.js';
import type { ActorContext } from '../../src/modules/academic/application/academic.types.js';
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
import { KpiService } from '../../src/modules/analytics/application/kpi.service.js';
import { KpiCache } from '../../src/modules/analytics/application/ports/kpi-cache.js';
import { KpiCacheInvalidator } from '../../src/modules/analytics/infrastructure/kpi-cache-invalidator.js';
import { KyselyKpiRepository } from '../../src/modules/analytics/infrastructure/persistence/kysely-kpi.repository.js';
import { type ExportsService } from '../../src/modules/exports/application/exports.service.js';
import { ReportGenerationService } from '../../src/modules/exports/application/report-generation.service.js';
import { StubEmailSender } from '../../src/shared/email/stub-email-sender.js';
import { NotificationDispatcher } from '../../src/modules/notifications/application/notification-dispatcher.js';
import { KyselyNotificationRepository } from '../../src/modules/notifications/infrastructure/persistence/kysely-notification.repository.js';
import { requireMigratorDatabaseUrl } from '../../src/shared/config/env.js';

const hasDatabase = Boolean(process.env.DATABASE_MIGRATOR_URL);
const PERIODO = '2026-1';

class MemoryKpiCache extends KpiCache {
  private readonly values = new Map<string, unknown>();
  invalidations = 0;

  get<T>(key: string): Promise<T | null> {
    return Promise.resolve((this.values.get(key) as T | undefined) ?? null);
  }

  set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }

  invalidateAll(): Promise<void> {
    this.invalidations += 1;
    this.values.clear();
    return Promise.resolve();
  }
}

describe.runIf(hasDatabase)(
  'Flujo C6 contra PostgreSQL: reportes, KPIs, caché y notificaciones',
  () => {
    let db: Kysely<Database>;
    let adminId: string;
    let grupoId: string;
    let sesionId: string;
    let matriculaRetiradaId: string;
    let reportData: KyselyReportDataProvider;
    let kpis: KpiService;
    let cache: MemoryKpiCache;
    let evaluationService: EvaluationService;

    function actor(overrides: Partial<ActorContext> = {}): ActorContext {
      return {
        userId: adminId,
        actorProfile: 'administrador',
        permissions: [
          'academic:program:manage',
          'academic:group:manage',
          'academic:student:manage',
          'academic:enrollment:create',
          'academic:session:create',
          'academic:session:update',
          'academic:attendance:create',
          'academic:evaluation:create',
          'analytics:kpi:read',
          'exports:report:create',
        ],
        ip: '127.0.0.1',
        userAgent: 'vitest-analytics-c6',
        requestId: uuidv7(),
        ...overrides,
      };
    }

    const idem = () => `idem-c6-${uuidv7()}`;

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
      await academicMigrator.migrateToLatest();

      await seedIdentity(db, {
        password: 'SemillaInicial#2026-test',
        withTemporaryIdentity: false,
      });
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
      const indicators = new KyselyIndicatorRepository(db);
      const evaluations = new KyselyEvaluationRepository(db);
      const unitOfWork = new KyselyAcademicUnitOfWork(db);
      const idempotency = new KyselyIdempotencyStore(db);

      const programService = new ProgramService(programs, unitOfWork, idempotency);
      const groupService = new GroupService(
        groups,
        programs,
        unitOfWork,
        idempotency,
        new KyselyUserDirectory(db),
      );
      const studentService = new StudentService(
        students,
        unitOfWork,
        idempotency,
        new SharedPiiCipher(),
        new KyselyAuditWriter(db),
      );
      const enrollmentService = new EnrollmentService(
        enrollments,
        groups,
        students,
        programs,
        unitOfWork,
        idempotency,
      );
      const sessionService = new SessionService(sessions, groups, unitOfWork, idempotency);
      const attendanceService = new AttendanceService(
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

      const programa = await programService.create(
        { nombre: 'Programa C6', descripcion: null, area: 'musica', cupoMaximo: 10 },
        actor(),
        idem(),
      );
      await programService.transition(programa.id, 'publicado', actor());

      const grupo = await groupService.create(
        {
          programaId: programa.id,
          codigo: `G-C6-${uuidv7().replaceAll('-', '').slice(-10)}`,
          educadorId: adminId,
          salon: 'Sala C6',
          periodo: PERIODO,
          cupoMaximo: 10,
        },
        actor(),
        idem(),
      );
      grupoId = grupo.id;

      const matriculas: string[] = [];
      for (let index = 0; index < 7; index += 1) {
        const estudiante = await studentService.create(
          {
            usuarioId: index === 0 ? adminId : null,
            tipoDocumento: 'CC',
            numeroDocumento: uuidv7().replaceAll('-', '').slice(-10),
            nombres: 'Estudiante',
            apellidos: `C6-${index}`,
            fechaNacimiento: null,
            municipio: index === 6 ? 'Palmira' : 'Cali',
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
          { estudianteId: estudiante.id, grupoId: grupo.id, periodo: PERIODO },
          actor(),
          idem(),
        );
        await enrollmentService.transition(matricula.id, 'confirmada', actor());
        await enrollmentService.transition(matricula.id, 'activa', actor());
        matriculas.push(matricula.id);
      }
      matriculaRetiradaId = matriculas[6]!;

      const sesion = await sessionService.create(
        { grupoId: grupo.id, fecha: '2026-09-14', tema: 'Sesión verificada' },
        actor(),
        idem(),
      );
      sesionId = sesion.id;
      await sessionService.transition(sesion.id, 'realizada', actor());

      await attendanceService.replace(
        sesion.id,
        matriculas.map((matriculaId, index) => ({
          matriculaId,
          estado: index === 5 ? 'ausente' : index === 4 ? 'tarde' : 'presente',
        })),
        actor(),
      );

      const indicador = await sql<{ id: string }>`
        select id from academic.indicador_evaluacion where programa_id is null limit 1
      `.execute(db);
      for (const [index, matriculaId] of matriculas.entries()) {
        const valor = index < 4 ? 'excelente' : index < 6 ? 'bueno' : 'regular';
        await evaluationService.create(
          {
            matriculaId,
            indicadorId: indicador.rows[0].id,
            periodo: PERIODO,
            valor,
            observacion: null,
          },
          actor(),
        );
      }

      await enrollmentService.transition(matriculaRetiradaId, 'retirada', actor());

      reportData = new KyselyReportDataProvider(db);
      cache = new MemoryKpiCache();
      kpis = new KpiService(new KyselyKpiRepository(db), cache);
    }, 120_000);

    afterAll(async () => {
      if (db) {
        const publicMigrator = createMigrator(db as Kysely<unknown>, 'public');
        const academicMigrator = createMigrator(db as Kysely<unknown>, 'academic');
        await publicMigrator.migrateTo(NO_MIGRATIONS);
        await academicMigrator.migrateTo(NO_MIGRATIONS);
        await db.destroy();
      }
    });

    const filtro = {
      periodo: PERIODO,
      programaId: null,
      grupoId: null,
      educadorId: null,
    };

    it('RB1-59: los reportes coinciden con SQL directo', async () => {
      const asistencia = await reportData.rowsFor('asistencia', filtro);
      const asistenciaSql = await sql<{
        grupo: string;
        sesion: string;
        estudiante: string;
        estado: string;
      }>`
        select g.codigo::text as grupo, s.id::text as sesion, m.id::text as estudiante,
               a.estado::text as estado
        from academic.asistencia a
        inner join academic.sesion_clase s on s.id = a.sesion_id
        inner join academic.matricula m on m.id = a.matricula_id
        inner join academic.grupo g on g.id = m.grupo_id
        where s.estado = 'realizada' and g.periodo = ${PERIODO}
        order by g.codigo asc, s.fecha asc, m.id asc
      `.execute(db);
      expect(asistencia).toEqual(
        asistenciaSql.rows.map((row) => ({
          grupo: row.grupo,
          sesion: row.sesion,
          estudiante: row.estudiante,
          estado: row.estado,
        })),
      );

      const matricula = await reportData.rowsFor('matricula', filtro);
      const matriculaSql = await sql<{
        programa: string;
        grupo: string;
        estado: string;
        total: number;
      }>`
        select p.nombre::text as programa, g.codigo::text as grupo, m.estado::text as estado,
               count(*)::int as total
        from academic.matricula m
        inner join academic.grupo g on g.id = m.grupo_id
        inner join academic.programa_formativo p on p.id = g.programa_id
        where g.periodo = ${PERIODO}
        group by p.nombre, g.codigo, m.estado
        order by p.nombre asc, g.codigo asc, m.estado asc
      `.execute(db);
      expect(matricula).toEqual(
        matriculaSql.rows.map((row) => ({
          programa: row.programa,
          grupo: row.grupo,
          estado: row.estado,
          total: row.total,
        })),
      );

      const desercion = await reportData.rowsFor('desercion', filtro);
      const desercionSql = await sql<{
        periodo: string;
        grupo: string;
        retiradas: number;
        porcentaje: number;
      }>`
        select g.periodo::text as periodo, g.codigo::text as grupo,
               (count(*) filter (where m.estado = 'retirada'))::int as retiradas,
               coalesce(round(100.0 * (count(*) filter (where m.estado = 'retirada'))
                 / nullif(count(*), 0), 2), 0)::float8 as porcentaje
        from academic.matricula m
        inner join academic.grupo g on g.id = m.grupo_id
        where m.estado in ('activa', 'finalizada', 'retirada') and g.periodo = ${PERIODO}
        group by g.periodo, g.codigo
        order by g.periodo asc, g.codigo asc
      `.execute(db);
      expect(desercion).toEqual(
        desercionSql.rows.map((row) => ({
          periodo: row.periodo,
          grupo: row.grupo,
          retiradas: row.retiradas,
          porcentaje: row.porcentaje,
        })),
      );
      expect(desercion[0]).toMatchObject({ retiradas: 1 });
    }, 60_000);

    it('RB1-59: tres KPIs coinciden con SQL directo y suprimen celdas < 5', async () => {
      const result = await kpis.list(
        { periodo: PERIODO, programaId: null, grupoId: null, kpi: null },
        { userId: adminId, permissions: ['analytics:kpi:read', 'academic:group:manage'] },
      );
      const byCode = new Map(result.map((kpi) => [kpi.code, kpi]));

      const direct = await sql<{
        activas: number;
        presentes: number;
        tardes: number;
        asistencia_total: number;
        excelente: number;
        bueno: number;
        evaluacion_total: number;
      }>`
        select
          (select count(*)::int from academic.matricula m
            where m.estado in ('preinscrita','confirmada','activa') and m.periodo = ${PERIODO}) as activas,
          (select count(*)::int from academic.asistencia a
            where a.estado = 'presente') as presentes,
          (select count(*)::int from academic.asistencia a
            where a.estado = 'tarde') as tardes,
          (select count(*)::int from academic.asistencia a) as asistencia_total,
          (select count(*)::int from academic.evaluacion_cualitativa e
            where e.valor = 'excelente' and e.periodo = ${PERIODO}) as excelente,
          (select count(*)::int from academic.evaluacion_cualitativa e
            where e.valor = 'bueno' and e.periodo = ${PERIODO}) as bueno,
          (select count(*)::int from academic.evaluacion_cualitativa e
            where e.periodo = ${PERIODO}) as evaluacion_total
      `.execute(db);
      const totals = direct.rows[0];
      const percentage = (part: number, total: number): number =>
        total === 0 ? 0 : Math.round((10_000 * part) / total) / 100;

      expect(byCode.get('matricula_activa')?.valor).toBe(totals.activas);
      expect(byCode.get('asistencia')?.valor).toBe(
        percentage(totals.presentes + totals.tardes, totals.asistencia_total),
      );
      expect(byCode.get('evaluacion')?.valor).toBe(
        percentage(totals.excelente + totals.bueno, totals.evaluacion_total),
      );

      const geografia = byCode.get('distribucion_geografica');
      expect(geografia?.desglose).toEqual([{ clave: 'Cali', total: 6 }]);
      expect(geografia?.desglose.some((item) => item.clave === 'Palmira')).toBe(false);
    }, 60_000);

    it('RB1-56: la caché se reutiliza y se invalida por eventos de auditoría', async () => {
      const query = {
        periodo: PERIODO,
        programaId: null,
        grupoId: null,
        kpi: 'matricula_activa',
      };
      const actorKpi = {
        userId: adminId,
        permissions: ['analytics:kpi:read', 'academic:group:manage'],
      };

      const first = await kpis.list(query, actorKpi);
      const second = await kpis.list(query, actorKpi);
      expect(second).toEqual(first);
      expect(cache.invalidations).toBe(0);

      const invalidator = new KpiCacheInvalidator(db, cache);
      const affected = await invalidator.tick();
      expect(affected).toBeGreaterThan(0);
      expect(cache.invalidations).toBe(1);
    }, 60_000);

    it('D83/D84: el ámbito ajeno se oculta y no se exporta ninguna fila', async () => {
      const educadorAjeno = uuidv7();
      await expect(
        kpis.list(
          { periodo: PERIODO, programaId: null, grupoId: grupoId, kpi: null },
          { userId: educadorAjeno, permissions: ['analytics:kpi:read'] },
        ),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });

      let exportaciones = 0;
      const fakeExports = {
        create: () => {
          exportaciones += 1;
          return Promise.resolve({} as never);
        },
      } as unknown as ExportsService;
      const reportService = new ReportGenerationService(reportData, fakeExports);

      await expect(
        reportService.generate({
          code: 'asistencia',
          periodo: PERIODO,
          formato: 'csv',
          programaId: null,
          grupoId: grupoId,
          idempotencyKey: 'clave-c6',
          actor: {
            userId: educadorAjeno,
            actorProfile: 'educador',
            permissions: ['exports:report:create'],
          },
          context: { ip: '127.0.0.1', userAgent: 'vitest', requestId: uuidv7() },
        }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
      expect(exportaciones).toBe(0);
    }, 60_000);

    it('D85: los dos eventos se publican por outbox y entregan con sus plantillas', async () => {
      const eventos = await db
        .selectFrom('evento_outbox')
        .selectAll()
        .where('tipo', 'in', ['evaluacion.publicada', 'recordatorio.fechas'])
        .execute();

      const publicacion = eventos.filter((evento) => evento.tipo === 'evaluacion.publicada');
      const recordatorio = eventos.filter((evento) => evento.tipo === 'recordatorio.fechas');
      expect(publicacion.length).toBe(1);
      expect(recordatorio.length).toBe(1);

      const payloadPublicacion = publicacion[0].payload as {
        usuarioIds?: string[];
        valor?: string;
      };
      const payloadRecordatorio = recordatorio[0].payload as {
        usuarioIds?: string[];
        sesionId?: string;
        fecha?: string;
      };
      expect(payloadPublicacion.usuarioIds).toContain(adminId);
      expect(payloadPublicacion.valor).toBe('excelente');
      expect(payloadRecordatorio.usuarioIds).toContain(adminId);
      expect(payloadRecordatorio.sesionId).toBe(sesionId);
      expect(payloadRecordatorio.fecha).toBe('2026-09-14');

      const dispatcher = new NotificationDispatcher(new StubEmailSender());
      for (const evento of [...publicacion, ...recordatorio]) {
        await db.transaction().execute((trx) =>
          dispatcher.dispatch(
            {
              id: evento.id,
              tipo: evento.tipo,
              agregado: evento.agregado,
              ocurridoEn: evento.creado_en,
              payload: evento.payload as Record<string, unknown>,
            },
            {
              notifications: new KyselyNotificationRepository(trx),
              audit: new KyselyAuditWriter(trx),
            },
          ),
        );
      }

      const notificaciones = await db
        .selectFrom('notificacion')
        .select(['evento', 'canal', 'plantilla_id', 'estado'])
        .where('evento', 'in', ['evaluacion.publicada', 'recordatorio.fechas'])
        .execute();
      expect(notificaciones).toHaveLength(4);
      expect(notificaciones.every((notificacion) => notificacion.estado === 'enviada')).toBe(true);

      const plantillas = await db
        .selectFrom('plantilla_notificacion')
        .select(['id', 'codigo'])
        .where('id', 'in', [
          '00000000-0000-4000-8000-000000000119',
          '00000000-0000-4000-8000-000000000120',
          '00000000-0000-4000-8000-000000000121',
          '00000000-0000-4000-8000-000000000122',
        ])
        .execute();
      expect(plantillas).toHaveLength(4);
      expect(notificaciones.map((notificacion) => notificacion.plantilla_id)).toEqual(
        expect.arrayContaining(plantillas.map((plantilla) => plantilla.id)),
      );

      const auditoria = await sql<{ total: number }>`
        select count(*)::int as total from public.evento_auditoria
        where accion in ('notificacion.enviada', 'notificacion.fallida')
      `.execute(db);
      expect(auditoria.rows[0].total).toBe(4);
    }, 60_000);
  },
);
