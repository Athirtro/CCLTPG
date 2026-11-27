import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMigrator } from '../../src/database/migrator/migrator-setup.js';
import type { Database } from '../../src/database/schema.js';
import { KyselyEmisoraRepository } from '../../src/modules/emisora/infrastructure/persistence/kysely-emisora.repository.js';
import { requireMigratorDatabaseUrl } from '../../src/shared/config/env.js';

const hasDatabase = Boolean(process.env.DATABASE_MIGRATOR_URL);

describe.runIf(hasDatabase)('Transiciones concurrentes de la emisora contra PostgreSQL', () => {
  let db: Kysely<Database>;
  let repository: KyselyEmisoraRepository;
  const sesionId = uuidv7();
  const actorUno = uuidv7();
  const actorDos = uuidv7();
  const transmisionId = uuidv7();
  const usuarioMifi = uuidv7();

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
      insert into emisora.sesion_grabacion (id, fecha, estado)
      values (${sesionId}::uuid, ${'2026-01-19'}::date, 'programada')
    `.execute(db);
    await sql`
      insert into emisora.transmision (id, fecha_transmision, es_fuera_ciudad)
      values (${transmisionId}::uuid, ${'2026-01-21'}::date, true)
    `.execute(db);
    repository = new KyselyEmisoraRepository(db);
  });

  afterAll(async () => {
    await sql`delete from emisora.prestamo_mifi where transmision_id = ${transmisionId}::uuid`.execute(
      db,
    );
    await sql`delete from emisora.transmision where id = ${transmisionId}::uuid`.execute(db);
    await sql`delete from emisora.sesion_grabacion where id = ${sesionId}::uuid`.execute(db);
    await db.destroy();
  });

  it('solo la transición con el estado de origen vigente actualiza la fila', async () => {
    const primera = await repository.updateGrabacionEstado(
      sesionId,
      'programada',
      'realizada',
      actorUno,
    );
    expect(primera.estado).toBe('realizada');

    await expect(
      repository.updateGrabacionEstado(sesionId, 'programada', 'cancelada', actorDos),
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });

    const actual = await repository.findGrabacionById(sesionId);
    expect(actual).toMatchObject({ estado: 'realizada', aprobadaPor: actorUno });
  });

  it('la base rechaza préstamos de mifi con menos de dos días calendario en Bogotá', async () => {
    // 06:00 UTC del 20 ya es 01:00 del 20 en Bogotá: solo un día de antelación.
    await expect(
      repository.createPrestamoMifi({
        id: uuidv7(),
        transmisionId,
        usuarioId: usuarioMifi,
        fechaSolicitud: new Date('2026-01-20T06:00:00.000Z'),
        fechaTransmision: '2026-01-21',
        observaciones: null,
      }),
    ).rejects.toMatchObject({ code: '23514' });

    // 12:00 UTC del 19 sigue siendo 19 en Bogotá: dos días justos, permitido.
    const valido = await repository.createPrestamoMifi({
      id: uuidv7(),
      transmisionId,
      usuarioId: usuarioMifi,
      fechaSolicitud: new Date('2026-01-19T12:00:00.000Z'),
      fechaTransmision: '2026-01-21',
      observaciones: null,
    });
    expect(valido).toMatchObject({ estado: 'solicitado', fechaTransmision: '2026-01-21' });
  });
});
