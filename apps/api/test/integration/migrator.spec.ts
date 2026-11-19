import * as path from 'node:path';

import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NO_MIGRATIONS } from 'kysely/migration';

import { requireMigratorDatabaseUrl } from '../../src/shared/config/env.js';
import { createMigrator } from '../../src/database/migrator/migrator-setup.js';

const migratorUrl = process.env.DATABASE_MIGRATOR_URL;
const hasDatabase = Boolean(migratorUrl);

const CORE_TABLES = [
  'usuario',
  'perfil',
  'permiso',
  'perfil_permiso',
  'usuario_perfil',
  'refresh_token',
  'codigo_recuperacion_mfa',
  'evento_auditoria',
] as const;

async function tableExists(db: Kysely<unknown>, name: string): Promise<boolean> {
  const result = await sql<{ exists: boolean }>`
    select to_regclass(${name}) is not null as exists
  `.execute(db);
  return result.rows[0]?.exists === true;
}

function newMigratorDb(): Kysely<unknown> {
  return new Kysely<unknown>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString: requireMigratorDatabaseUrl(),
        max: 1,
        application_name: 'ccltpg-migrator-test',
      }),
    }),
  });
}

describe.runIf(hasDatabase)('Migrador Kysely contra PostgreSQL real', () => {
  let db: Kysely<unknown>;

  beforeAll(() => {
    db = newMigratorDb();
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
    await expect(tableExists(db, 'public.health_probe')).resolves.toBe(true);

    const down = await migrator.migrateDown();
    expect(down.error).toBeUndefined();
    await expect(tableExists(db, 'public.health_probe')).resolves.toBe(false);

    const again = await migrator.migrateToLatest();
    expect(again.error).toBeUndefined();
    await expect(tableExists(db, 'public.health_probe')).resolves.toBe(true);

    await migrator.migrateDown();
  });

  it('mantiene historiales separados por esquema', async () => {
    const folder = path.join(import.meta.dirname, '..', 'fixtures', 'migrations', 'academic');
    const migrator = createMigrator(db, 'academic', folder);

    const result = await migrator.migrateToLatest();
    expect(result.error).toBeUndefined();
    await expect(tableExists(db, 'academic.health_probe')).resolves.toBe(true);

    const applied = await sql<{ name: string }>`
      select name from academic.kysely_migration
    `.execute(db);
    expect(applied.rows.map((row) => row.name)).toContain('0001_create_health_probe');

    await migrator.migrateDown();
    await expect(tableExists(db, 'academic.health_probe')).resolves.toBe(false);
  });
});

describe.runIf(hasDatabase)('Migraciones del núcleo (C2 — RB1-15)', () => {
  let db: Kysely<unknown>;

  beforeAll(() => {
    db = newMigratorDb();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('aplica el núcleo con up → down → up sobre base vacía en public', async () => {
    const migrator = createMigrator(db, 'public');

    const up = await migrator.migrateToLatest();
    expect(up.error).toBeUndefined();
    for (const table of CORE_TABLES) {
      await expect(tableExists(db, `public.${table}`)).resolves.toBe(true);
    }

    const down = await migrator.migrateTo(NO_MIGRATIONS);
    expect(down.error).toBeUndefined();
    for (const table of CORE_TABLES) {
      await expect(tableExists(db, `public.${table}`)).resolves.toBe(false);
    }

    const again = await migrator.migrateToLatest();
    expect(again.error).toBeUndefined();
    await expect(tableExists(db, 'public.evento_auditoria')).resolves.toBe(true);

    const column = await sql<{ present: boolean }>`
      select count(*) > 0 as present
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'usuario'
        and column_name = 'debe_cambiar_password'
    `.execute(db);
    expect(column.rows[0]?.present).toBe(true);

    const indexes = await sql<{ indexname: string }>`
      select indexname from pg_indexes
      where schemaname = 'public'
        and indexname in ('refresh_token_token_hash_idx', 'codigo_recuperacion_mfa_usuario_usado_idx')
    `.execute(db);
    expect(indexes.rows).toHaveLength(2);

    await migrator.migrateTo(NO_MIGRATIONS);
  });
});
