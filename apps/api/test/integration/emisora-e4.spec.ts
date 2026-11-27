import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMigrator } from '../../src/database/migrator/migrator-setup.js';
import type { Database } from '../../src/database/schema.js';
import { KyselyEmisoraRepository } from '../../src/modules/emisora/infrastructure/persistence/kysely-emisora.repository.js';
import { requireMigratorDatabaseUrl } from '../../src/shared/config/env.js';
import { resolveRequestId } from '../../src/shared/observability/request-id.js';

const hasDatabase = Boolean(process.env.DATABASE_MIGRATOR_URL);

describe.runIf(hasDatabase)('E4: reglas de la sede contra PostgreSQL', () => {
  let db: Kysely<Database>;
  let repository: KyselyEmisoraRepository;
  const transmisorId = uuidv7();
  const operadorId = uuidv7();
  const turnoId = uuidv7();
  const lecturaId = uuidv7();
  const proyeccionId = uuidv7();
  const planillaId = uuidv7();
  const actividadId = uuidv7();
  const permisoId = uuidv7();
  const bitacorasIds: string[] = [];
  const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  beforeAll(async () => {
    db = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({ connectionString: requireMigratorDatabaseUrl(), max: 2 }),
      }),
    });
    const migrator = createMigrator(db as Kysely<unknown>, 'emisora');
    const migrated = await migrator.migrateToLatest();
    expect(migrated.error).toBeUndefined();

    await sql`
      insert into emisora.transmisor (id, codigo, nombre, sede, frecuencia)
      values (
        ${transmisorId}::uuid,
        ${`E4-${transmisorId}`},
        'Transmisor E4',
        'Sede de pruebas',
        '107.9'
      )
    `.execute(db);
    await sql`
      insert into emisora.actividad_cultural (id, nombre, fecha)
      values (${actividadId}::uuid, 'Actividad E4', '2026-01-19')
    `.execute(db);
    repository = new KyselyEmisoraRepository(db);
  });

  afterAll(async () => {
    if (bitacorasIds.length > 0) {
      await sql`delete from emisora.bitacora_sede where id = any(${bitacorasIds}::uuid[])`.execute(
        db,
      );
    }
    await sql`delete from emisora.lectura_transmisor where id = ${lecturaId}::uuid`.execute(db);
    await sql`delete from emisora.turno_operador where id = ${turnoId}::uuid`.execute(db);
    await sql`delete from emisora.planilla_emision where id = ${planillaId}::uuid`.execute(db);
    await sql`delete from emisora.permiso_gobierno where id = ${permisoId}::uuid`.execute(db);
    await sql`delete from emisora.actividad_cultural where id = ${actividadId}::uuid`.execute(db);
    await sql`delete from emisora.proyeccion_anual where id = ${proyeccionId}::uuid`.execute(db);
    await sql`delete from emisora.transmisor where id = ${transmisorId}::uuid`.execute(db);
    await db.destroy();
  });

  it('traduce la única de lecturas a un error de dominio', async () => {
    await repository.createLectura({
      id: lecturaId,
      transmisorId,
      fecha: '2026-01-19',
      potenciaW: 1000,
      frecuencia: '107.9',
      observaciones: null,
      registradoPor: operadorId,
    });
    await expect(
      repository.createLectura({
        id: uuidv7(),
        transmisorId,
        fecha: '2026-01-19',
        potenciaW: 1200,
        frecuencia: null,
        observaciones: null,
        registradoPor: operadorId,
      }),
    ).rejects.toMatchObject({ code: 'EMISORA_LECTURA_DUPLICADA' });
  });

  it('solo aplica la transición de turno desde el estado vigente', async () => {
    await repository.createTurno({
      id: turnoId,
      transmisorId,
      operadorId,
      fecha: '2026-01-19',
      horaInicio: '06:00',
      horaFin: '07:00',
    });
    await expect(
      repository.updateTurnoEstado(turnoId, 'planificado', 'confirmado'),
    ).resolves.toMatchObject({ estado: 'confirmado' });
    await expect(
      repository.updateTurnoEstado(turnoId, 'planificado', 'realizado'),
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    await expect(repository.findTurnoById(turnoId)).resolves.toMatchObject({
      estado: 'confirmado',
    });
  });

  it('rechaza dos proyecciones para el mismo año', async () => {
    await repository.createProyeccion({
      id: proyeccionId,
      anio: 2026,
      equipoId: null,
      descripcion: 'Renovación anual',
      archivoId: null,
    });
    await expect(
      repository.createProyeccion({
        id: uuidv7(),
        anio: 2026,
        equipoId: null,
        descripcion: 'Duplicada',
        archivoId: null,
      }),
    ).rejects.toMatchObject({ code: 'EMISORA_PROYECCION_DUPLICADA' });
    await expect(
      repository.updateProyeccionEstado(proyeccionId, 'borrador', 'aprobada'),
    ).resolves.toMatchObject({ estado: 'aprobada' });
  });

  it('registra la planilla como registrada y rechaza otra para la misma fecha', async () => {
    await expect(
      repository.createPlanilla({
        id: planillaId,
        fecha: '2026-01-19',
        programacionDiariaId: null,
        operadorId,
        archivoId: uuidv7(),
        estado: 'registrada',
      }),
    ).resolves.toMatchObject({ estado: 'registrada' });
    await expect(
      repository.createPlanilla({
        id: uuidv7(),
        fecha: '2026-01-19',
        programacionDiariaId: null,
        operadorId,
        archivoId: uuidv7(),
        estado: 'registrada',
      }),
    ).rejects.toMatchObject({ code: 'EMISORA_PLANILLA_DUPLICADA' });
  });

  it('persiste el permiso de salida en estado emitido', async () => {
    await expect(
      repository.createPermisoGobierno({
        id: permisoId,
        actividadId,
        oficioArchivoId: uuidv7(),
        destino: 'Alcaldía',
        fechaEmision: '2026-01-19',
        estado: 'emitido',
      }),
    ).resolves.toMatchObject({ estado: 'emitido' });
    const fila = await db
      .selectFrom('emisora.permiso_gobierno')
      .select('estado')
      .where('id', '=', permisoId)
      .executeTakeFirstOrThrow();
    expect(fila.estado).toBe('emitido');
  });

  it('guarda un request_id UUID correlacionado o lo genera cuando no es válido', async () => {
    const correlacionado = resolveRequestId('cabecera-invalida');
    expect(correlacionado).toMatch(UUID_V7);

    const conCorrelacion = await repository.createBitacora({
      id: uuidv7(),
      transmisorId,
      turnoId: null,
      fecha: '2026-01-19',
      incidente: 'Correlación conservada',
      accion: null,
      actorId: operadorId,
      requestId: correlacionado,
    });
    bitacorasIds.push(conCorrelacion.id);

    const sinCorrelacion = await repository.createBitacora({
      id: uuidv7(),
      transmisorId,
      turnoId: null,
      fecha: '2026-01-19',
      incidente: 'Correlación generada',
      accion: null,
      actorId: operadorId,
      requestId: 'request-no-uuid',
    });
    bitacorasIds.push(sinCorrelacion.id);

    const filas = await db
      .selectFrom('emisora.bitacora_sede')
      .select(['id', 'request_id'])
      .where('id', 'in', bitacorasIds)
      .execute();
    const porId = new Map(filas.map((fila) => [fila.id, fila.request_id]));
    expect(porId.get(conCorrelacion.id)).toBe(correlacionado);
    expect(porId.get(sinCorrelacion.id)).toMatch(UUID_V7);
  });
});
