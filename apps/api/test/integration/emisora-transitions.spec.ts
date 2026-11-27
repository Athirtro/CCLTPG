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
    repository = new KyselyEmisoraRepository(db);
  });

  afterAll(async () => {
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
});
