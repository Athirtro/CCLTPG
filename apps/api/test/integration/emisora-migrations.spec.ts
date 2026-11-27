import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NO_MIGRATIONS } from 'kysely/migration';

import { requireMigratorDatabaseUrl } from '../../src/shared/config/env.js';
import { createMigrator } from '../../src/database/migrator/migrator-setup.js';
import type { Database } from '../../src/database/schema.js';
import { seedEmisora } from '../../src/database/seeds/emisora.seed.js';

const migratorUrl = process.env.DATABASE_MIGRATOR_URL;
const hasDatabase = Boolean(migratorUrl);

/** Las 43 tablas creadas por las cuatro migraciones de `emisora` (§4.1 + §11). */
const EMISORA_TABLES = [
  'convocatoria',
  'realizador',
  'proyecto_programa',
  'comite',
  'rejilla_anual',
  'rejilla_anual_item',
  'programacion_diaria',
  'programacion_item',
  'sesion_grabacion',
  'audio',
  'asistencia_cabina',
  'informe_realizador',
  'incentivo',
  'resolucion_incentivo',
  'patrocinio',
  'orden_emision',
  'promo',
  'publicacion',
  'transmision',
  'salida_equipo',
  'reporte_desplazamiento',
  'prestamo_mifi',
  'viatico',
  'turno_operador',
  'lectura_transmisor',
  'bitacora_sede',
  'parametro_reporte',
  'obra',
  'reporte_obra',
  'pago_derechos',
  'hoja_vida_equipo',
  'actualizacion_tecnologica',
  'proyeccion_anual',
  'inversion_seguimiento',
  'version_software',
  'asignacion_equipo',
  'actividad_cultural',
  'permiso_gobierno',
  'tramite_externo',
  'soporte_tramite',
  'planilla_emision',
  'archivo_emisora',
  'transmisor',
] as const;

const EMISORA_CONSTRAINTS = [
  'convocatoria_plazo_check',
  'convocatoria_anio_key',
  'realizador_documento_hash_check',
  'proyecto_programa_archivo_check',
  'asistencia_cabina_sesion_usuario_key',
  'prestamo_mifi_antelacion_check',
  'lectura_transmisor_transmisor_fecha_key',
  'programacion_item_franja_no_solape',
] as const;

const EMISORA_INDEXES = [
  'convocatoria_estado_cierre_idx',
  'realizador_usuario_idx',
  'proyecto_convocatoria_estado_idx',
  'proyecto_realizador_idx',
  'rejilla_item_rejilla_dia_idx',
  'programacion_diaria_rejilla_fecha_idx',
  'programacion_item_fecha_hora_idx',
  'sesion_grabacion_fecha_estado_idx',
  'audio_sesion_idx',
  'incentivo_estado_idx',
  'transmision_fecha_estado_idx',
  'prestamo_mifi_usuario_fecha_idx',
  'lectura_transmisor_registro_idx',
  'obra_fecha_inclusion_idx',
  'equipo_estado_idx',
  'tramite_estado_destino_idx',
  'archivo_emisora_tipo_fecha_idx',
] as const;

async function tableExists(db: Kysely<unknown>, name: string): Promise<boolean> {
  const result = await sql<{ exists: boolean }>`
    select to_regclass(${name}) is not null as exists
  `.execute(db);
  return result.rows[0]?.exists === true;
}

/**
 * Igual que el fixture de `migrator.spec.ts`, pero para `emisora`: comparte
 * esquema e historial con las migraciones reales, así que se reinicia antes de
 * cada prueba para que el orden de ejecución no altere el resultado.
 */
async function resetEmisoraSchema(db: Kysely<unknown>): Promise<void> {
  const tables = await sql<{ tablename: string }>`
    select tablename from pg_tables
    where schemaname = 'emisora'
      and tablename not in ('kysely_migration', 'kysely_migration_lock')
  `.execute(db);
  for (const table of tables.rows) {
    await sql`drop table if exists ${sql.ref(`emisora.${table.tablename}`)} cascade`.execute(db);
  }
  const enums = await sql<{ typname: string }>`
    select t.typname
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'emisora' and t.typtype = 'e'
  `.execute(db);
  for (const type of enums.rows) {
    await sql`drop type if exists ${sql.ref(`emisora.${type.typname}`)} cascade`.execute(db);
  }
  const history = await sql<{ exists: boolean }>`
    select to_regclass(${`emisora.kysely_migration`}) is not null as exists
  `.execute(db);
  if (history.rows[0]?.exists === true) {
    await sql`delete from ${sql.ref('emisora.kysely_migration')}`.execute(db);
  }
}

function newMigratorDb(): Kysely<unknown> {
  return new Kysely<unknown>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString: requireMigratorDatabaseUrl(),
        max: 1,
        application_name: 'ccltpg-emisora-migrator-test',
      }),
    }),
  });
}

describe.runIf(hasDatabase)('Migraciones de la emisora (E1)', () => {
  let db: Kysely<unknown>;

  beforeAll(() => {
    db = newMigratorDb();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('aplica up → down → up de las cuatro migraciones sobre base vacía', async () => {
    await resetEmisoraSchema(db);
    const migrator = createMigrator(db, 'emisora');
    await migrator.migrateTo(NO_MIGRATIONS);

    const up = await migrator.migrateToLatest();
    expect(up.error).toBeUndefined();
    expect(up.results?.map((item) => item.migrationName)).toEqual([
      '0001_create_emisora_core',
      '0002_create_emisora_operation',
      '0003_create_emisora_reporting',
      '0004_emisora_indexes',
    ]);
    for (const table of EMISORA_TABLES) {
      await expect(tableExists(db, `emisora.${table}`)).resolves.toBe(true);
    }

    const applied = await sql<{ name: string }>`
      select name from emisora.kysely_migration order by name
    `.execute(db);
    expect(applied.rows.map((row) => row.name)).toEqual(
      up.results?.map((item) => item.migrationName),
    );

    const constraints = await sql<{ conname: string; contype: string }>`
      select conname, contype
      from pg_constraint
      where connamespace = 'emisora'::regnamespace
        and conname::text = any(${[...EMISORA_CONSTRAINTS]}::text[])
    `.execute(db);
    expect(constraints.rows.map((row) => row.conname).sort()).toEqual(
      [...EMISORA_CONSTRAINTS].sort(),
    );
    expect(
      constraints.rows.find((row) => row.conname === 'programacion_item_franja_no_solape')?.contype,
    ).toBe('x');

    const indexes = await sql<{ indexname: string }>`
      select indexname from pg_indexes where schemaname = 'emisora'
    `.execute(db);
    for (const index of EMISORA_INDEXES) {
      expect(indexes.rows.map((row) => row.indexname)).toContain(index);
    }

    const down = await migrator.migrateTo(NO_MIGRATIONS);
    expect(down.error).toBeUndefined();
    for (const table of EMISORA_TABLES) {
      await expect(tableExists(db, `emisora.${table}`)).resolves.toBe(false);
    }
    const leftover = await sql<{ indexname: string }>`
      select indexname from pg_indexes
      where schemaname = 'emisora'
        and tablename not in ('kysely_migration', 'kysely_migration_lock')
    `.execute(db);
    expect(leftover.rows.map((row) => row.indexname)).toEqual([]);

    const again = await migrator.migrateToLatest();
    expect(again.error).toBeUndefined();
    for (const table of EMISORA_TABLES) {
      await expect(tableExists(db, `emisora.${table}`)).resolves.toBe(true);
    }

    await migrator.migrateTo(NO_MIGRATIONS);
  });

  it('impide la convocatoria duplicada y el plazo distinto de tres semanas', async () => {
    const migrator = createMigrator(db, 'emisora');
    await migrator.migrateToLatest();

    const id = '11111111-1111-5111-8111-111111111111';
    await sql`
      insert into emisora.convocatoria (id, anio, fecha_apertura, fecha_cierre, estado)
      values (${id}, 2030, date '2030-01-15', date '2030-02-05', 'abierta')
    `.execute(db);

    await expect(
      sql`
        insert into emisora.convocatoria (id, anio, fecha_apertura, fecha_cierre, estado)
        values (
          '22222222-2222-5222-8222-222222222222', 2030,
          date '2030-01-15', date '2030-02-05', 'abierta'
        )
      `.execute(db),
    ).rejects.toThrow();

    await expect(
      sql`
        insert into emisora.convocatoria (id, anio, fecha_apertura, fecha_cierre, estado)
        values (
          '33333333-3333-5333-8333-333333333333', 2031,
          date '2031-01-15', date '2031-02-06', 'abierta'
        )
      `.execute(db),
    ).rejects.toThrow();

    const rows = await sql<{ total: number }>`
      select count(*)::int as total from emisora.convocatoria
    `.execute(db);
    expect(rows.rows[0]?.total).toBe(1);

    await migrator.migrateTo(NO_MIGRATIONS);
  });

  it('siembra fechas de calendario exactas y es idempotente', async () => {
    const migrator = createMigrator(db, 'emisora');
    await migrator.migrateToLatest();

    await seedEmisora(db as Kysely<Database>);
    await seedEmisora(db as Kysely<Database>);

    const rows = await sql<{ apertura: string; cierre: string; total: number }>`
      select
        fecha_apertura::text as apertura,
        fecha_cierre::text as cierre,
        count(*) over ()::int as total
      from emisora.convocatoria
      where anio = 2026
    `.execute(db);
    expect(rows.rows).toEqual([{ apertura: '2026-01-15', cierre: '2026-02-05', total: 1 }]);

    await migrator.migrateTo(NO_MIGRATIONS);
  });
});
