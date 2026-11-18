import * as path from 'node:path';

import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { requireMigratorDatabaseUrl } from '../../src/shared/config/env.js';
import { createMigrator } from '../../src/database/migrator/migrator-setup.js';

const migratorUrl = process.env.DATABASE_MIGRATOR_URL;
const hasDatabase = Boolean(migratorUrl);

describe.runIf(hasDatabase)('Migrador Kysely contra PostgreSQL real', () => {
  let db: Kysely<unknown>;

  beforeAll(() => {
    db = new Kysely<unknown>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({
          connectionString: requireMigratorDatabaseUrl(),
          max: 1,
          application_name: 'ccltpg-migrator-test',
        }),
      }),
    });
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('aplica up → down → up sobre base vacía en public', async () => {
    const folder = path.join(import.meta.dirname, '..', 'fixtures', 'migrations', 'public');
    const migrator = createMigrator(db, 'public', folder);

    const first = await migrator.migrateToLatest();
    expect(first.error).toBeUndefined();
    expect(first.results).toEqual([
      expect.objectContaining({ migrationName: '0001_create_health_probe', status: 'Success' }),
    ]);
    await expect(tableExists('public.health_probe')).resolves.toBe(true);

    const down = await migrator.migrateDown();
    expect(down.error).toBeUndefined();
    await expect(tableExists('public.health_probe')).resolves.toBe(false);

    const again = await migrator.migrateToLatest();
    expect(again.error).toBeUndefined();
    await expect(tableExists('public.health_probe')).resolves.toBe(true);

    await migrator.migrateDown();
  });

  it('mantiene historiales separados por esquema', async () => {
    const folder = path.join(import.meta.dirname, '..', 'fixtures', 'migrations', 'academic');
    const migrator = createMigrator(db, 'academic', folder);

    const result = await migrator.migrateToLatest();
    expect(result.error).toBeUndefined();
    await expect(tableExists('academic.health_probe')).resolves.toBe(true);

    const applied = await sql<{ name: string }>`
      select name from academic.kysely_migration
    `.execute(db);
    expect(applied.rows.map((row) => row.name)).toContain('0001_create_health_probe');

    await migrator.migrateDown();
    await expect(tableExists('academic.health_probe')).resolves.toBe(false);
  });

  async function tableExists(name: string): Promise<boolean> {
    const result = await sql<{ exists: boolean }>`
      select to_regclass(${name}) is not null as exists
    `.execute(db);
    return result.rows[0]?.exists === true;
  }
});
