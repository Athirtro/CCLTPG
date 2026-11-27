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

const C3_TABLES = [
  'archivo',
  'plantilla_notificacion',
  'notificacion',
  'preferencia_notificacion',
  'idempotency_key',
  'evento_outbox',
] as const;

async function tableExists(db: Kysely<unknown>, name: string): Promise<boolean> {
  const result = await sql<{ exists: boolean }>`
    select to_regclass(${name}) is not null as exists
  `.execute(db);
  return result.rows[0]?.exists === true;
}

/**
 * Los fixtures comparten esquema e historial con las migraciones reales. Se
 * reinicia por completo para que el orden de ejecución de los archivos no
 * altere el resultado (Vitest ordena por duración histórica).
 */
async function resetFixtureSchema(
  db: Kysely<unknown>,
  schema: 'public' | 'academic',
): Promise<void> {
  const tables = await sql<{ tablename: string }>`
    select tablename from pg_tables
    where schemaname = ${schema}
      and tablename not in ('kysely_migration', 'kysely_migration_lock')
  `.execute(db);
  for (const table of tables.rows) {
    await sql`drop table if exists ${sql.ref(`${schema}.${table.tablename}`)} cascade`.execute(db);
  }
  const sequences = await sql<{ sequencename: string }>`
    select sequencename from pg_sequences where schemaname = ${schema}
  `.execute(db);
  for (const sequence of sequences.rows) {
    await sql`drop sequence if exists ${sql.ref(`${schema}.${sequence.sequencename}`)} cascade`.execute(
      db,
    );
  }
  const enums = await sql<{ typname: string }>`
    select t.typname
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = ${schema} and t.typtype = 'e'
  `.execute(db);
  for (const type of enums.rows) {
    await sql`drop type if exists ${sql.ref(`${schema}.${type.typname}`)} cascade`.execute(db);
  }
  const history = await sql<{ exists: boolean }>`
    select to_regclass(${`${schema}.kysely_migration`}) is not null as exists
  `.execute(db);
  if (history.rows[0]?.exists === true) {
    await sql`delete from ${sql.ref(`${schema}.kysely_migration`)}`.execute(db);
  }
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
    await resetFixtureSchema(db, 'public');

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
    await resetFixtureSchema(db, 'academic');

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
    await resetFixtureSchema(db, 'public');
    const migrator = createMigrator(db, 'public');
    await migrator.migrateTo(NO_MIGRATIONS);

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

const C4_TABLES = [
  'academic.programa_formativo',
  'academic.grupo',
  'academic.horario_grupo',
  'academic.estudiante',
  'academic.matricula',
] as const;

const C5_TABLES = [
  'academic.sesion_clase',
  'academic.asistencia',
  'academic.indicador_evaluacion',
  'academic.evaluacion_cualitativa',
] as const;

describe.runIf(hasDatabase)('Migraciones de C4 (contexto académico)', () => {
  let db: Kysely<unknown>;

  beforeAll(() => {
    db = newMigratorDb();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('aplica el núcleo académico con up → down → up y unicidad parcial', async () => {
    const publicMigrator = createMigrator(db, 'public');
    const academicMigrator = createMigrator(db, 'academic');
    await publicMigrator.migrateTo(NO_MIGRATIONS);
    await academicMigrator.migrateTo(NO_MIGRATIONS);

    const up = await academicMigrator.migrateToLatest();
    expect(up.error).toBeUndefined();
    for (const table of C4_TABLES) {
      await expect(tableExists(db, table)).resolves.toBe(true);
    }

    const indexes = await sql<{ indexname: string }>`
      select indexname from pg_indexes
      where schemaname = 'academic'
        and indexname in (
          'matricula_vigente_unique',
          'matricula_grupo_estado_idx',
          'horario_grupo_grupo_dia_idx',
          'grupo_educador_periodo_idx'
        )
    `.execute(db);
    expect(indexes.rows).toHaveLength(4);

    const partial = await sql<{ predicate: string | null }>`
      select pg_get_expr(i.indpred, i.indrelid) as predicate
      from pg_index i
      join pg_class c on c.oid = i.indrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'academic' and c.relname = 'matricula'
        and i.indisunique and i.indpred is not null
    `.execute(db);
    expect(partial.rows[0]?.predicate).toContain('preinscrita');

    const down = await academicMigrator.migrateTo(NO_MIGRATIONS);
    expect(down.error).toBeUndefined();
    for (const table of C4_TABLES) {
      await expect(tableExists(db, table)).resolves.toBe(false);
    }

    const again = await academicMigrator.migrateToLatest();
    expect(again.error).toBeUndefined();
    await expect(tableExists(db, 'academic.matricula')).resolves.toBe(true);

    // public/0007 siembra 12 plantillas académicas, public/0008 añade 4 de C6
    // y public/0009 añade 16 de Emisora R.A.C. (EL-4).
    await publicMigrator.migrateToLatest();
    const templates = await sql<{ total: number }>`
      select count(*)::int as total from public.plantilla_notificacion
    `.execute(db);
    expect(templates.rows[0]?.total).toBe(38);
    const emisoraCodes = await sql<{ total: number }>`
      select count(*)::int as total from public.plantilla_notificacion
      where codigo in ('convocatoria.abierta', 'convocatoria.cerrada',
        'rejilla.aprobada', 'grabacion.programada', 'informe.recibido',
        'incentivo.asignado', 'transmision.autorizada', 'turno.asignado')
    `.execute(db);
    expect(emisoraCodes.rows[0]?.total).toBe(16);
    const academicCodes = await sql<{ total: number }>`
      select count(*)::int as total from public.plantilla_notificacion
      where codigo in ('matricula.creada', 'matricula.activada', 'matricula.finalizada',
        'matricula.cancelada', 'matricula.retirada', 'horario.modificado')
    `.execute(db);
    expect(academicCodes.rows[0]?.total).toBe(12);
    const c6Codes = await sql<{ total: number }>`
      select count(*)::int as total from public.plantilla_notificacion
      where codigo in ('evaluacion.publicada', 'recordatorio.fechas')
    `.execute(db);
    expect(c6Codes.rows[0]?.total).toBe(4);

    await publicMigrator.migrateTo(NO_MIGRATIONS);
    await academicMigrator.migrateTo(NO_MIGRATIONS);
  });
});

describe.runIf(hasDatabase)('Migraciones de C5 (Académico B)', () => {
  let db: Kysely<unknown>;

  beforeAll(() => {
    db = newMigratorDb();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('aplica Académico B con up → down → up, unicidades y escala cerrada', async () => {
    await resetFixtureSchema(db, 'public');
    await resetFixtureSchema(db, 'academic');
    const migrator = createMigrator(db, 'academic');

    const up = await migrator.migrateToLatest();
    expect(up.error).toBeUndefined();
    for (const table of C5_TABLES) {
      await expect(tableExists(db, table)).resolves.toBe(true);
    }

    const indexes = await sql<{ indexname: string }>`
      select indexname from pg_indexes
      where schemaname = 'academic'
        and indexname in (
          'asistencia_sesion_matricula_key',
          'evaluacion_cualitativa_unique',
          'asistencia_matricula_idx',
          'sesion_clase_grupo_fecha_idx',
          'sesion_clase_estado_idx',
          'evaluacion_cualitativa_matricula_idx',
          'indicador_evaluacion_programa_idx'
        )
    `.execute(db);
    expect(indexes.rows).toHaveLength(7);

    const scale = await sql<{ enumlabel: string }>`
      select e.enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'academic' and t.typname = 'evaluacion_valor'
      order by e.enumsortorder
    `.execute(db);
    expect(scale.rows.map((row) => row.enumlabel)).toEqual([
      'excelente',
      'bueno',
      'regular',
      'deficiente',
    ]);

    const down = await migrator.migrateTo(NO_MIGRATIONS);
    expect(down.error).toBeUndefined();
    for (const table of C5_TABLES) {
      await expect(tableExists(db, table)).resolves.toBe(false);
    }

    const again = await migrator.migrateToLatest();
    expect(again.error).toBeUndefined();
    await expect(tableExists(db, 'academic.evaluacion_cualitativa')).resolves.toBe(true);

    await migrator.migrateTo(NO_MIGRATIONS);
  });
});

describe.runIf(hasDatabase)('Migraciones de C3 (archivos, notificaciones, outbox)', () => {
  let db: Kysely<unknown>;

  beforeAll(() => {
    db = newMigratorDb();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('aplica C3 con up → down → up y siembra las plantillas', async () => {
    const migrator = createMigrator(db, 'public');
    await migrator.migrateTo(NO_MIGRATIONS);

    const up = await migrator.migrateToLatest();
    expect(up.error).toBeUndefined();
    for (const table of C3_TABLES) {
      await expect(tableExists(db, `public.${table}`)).resolves.toBe(true);
    }

    const templates = await sql<{ total: number }>`
      select count(*)::int as total from public.plantilla_notificacion
    `.execute(db);
    // C3 siembra 6, C4 añade 12 (public/0007), C6 añade 4 (public/0008) y
    // Emisora añade 16 (public/0009).
    expect(templates.rows[0]?.total).toBe(38);

    const indexes = await sql<{ indexname: string }>`
      select indexname from pg_indexes
      where schemaname = 'public'
        and indexname in (
          'archivo_estado_creado_idx',
          'notificacion_usuario_creado_idx',
          'idempotency_key_expira_idx',
          'evento_outbox_estado_disponible_idx'
        )
    `.execute(db);
    expect(indexes.rows).toHaveLength(4);

    const down = await migrator.migrateTo(NO_MIGRATIONS);
    expect(down.error).toBeUndefined();
    for (const table of C3_TABLES) {
      await expect(tableExists(db, `public.${table}`)).resolves.toBe(false);
    }

    const again = await migrator.migrateToLatest();
    expect(again.error).toBeUndefined();
    await expect(tableExists(db, 'public.evento_outbox')).resolves.toBe(true);

    await migrator.migrateTo(NO_MIGRATIONS);
  });
});
