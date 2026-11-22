import { sql, type Kysely } from 'kysely';

/**
 * Migración de archivos (C3 — RB1-20).
 *
 * Crea `public.archivo` con los metadatos del diccionario §2.8 y el enum de
 * estado de escaneo. El contenido binario vive en el almacén de objetos; la
 * ruta se deriva del hash SHA-256 para permitir deduplicación física.
 *
 * `subido_por` es una referencia lógica a `public.usuario` (diccionario §6),
 * sin FK entre contextos.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createType('archivo_estado_escaneo')
    .asEnum(['pendiente', 'limpio', 'infectado'])
    .execute();

  await db.schema
    .createTable('archivo')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('nombre_original', 'text', (column) => column.notNull())
    .addColumn('mime', 'text', (column) => column.notNull())
    .addColumn('tamano', 'integer', (column) => column.notNull())
    .addColumn('hash_sha256', 'text', (column) => column.notNull())
    .addColumn('ruta_objeto', 'text', (column) => column.notNull())
    .addColumn('subido_por', 'uuid', (column) => column.notNull())
    .addColumn('estado_escaneo', sql`archivo_estado_escaneo`, (column) =>
      column.notNull().defaultTo('pendiente'),
    )
    .addColumn('creado_en', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addCheckConstraint('archivo_tamano_check', sql`tamano > 0`)
    .addCheckConstraint('archivo_hash_sha256_check', sql`hash_sha256 ~ '^[a-f0-9]{64}$'`)
    .execute();

  await db.schema
    .createIndex('archivo_hash_sha256_idx')
    .on('archivo')
    .columns(['hash_sha256'])
    .execute();

  await db.schema
    .createIndex('archivo_subido_por_idx')
    .on('archivo')
    .columns(['subido_por'])
    .execute();

  await db.schema
    .createIndex('archivo_estado_creado_idx')
    .on('archivo')
    .columns(['estado_escaneo', 'creado_en'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('archivo_estado_creado_idx').ifExists().execute();
  await db.schema.dropIndex('archivo_subido_por_idx').ifExists().execute();
  await db.schema.dropIndex('archivo_hash_sha256_idx').ifExists().execute();
  await db.schema.dropTable('archivo').ifExists().execute();
  await db.schema.dropType('archivo_estado_escaneo').ifExists().execute();
}
