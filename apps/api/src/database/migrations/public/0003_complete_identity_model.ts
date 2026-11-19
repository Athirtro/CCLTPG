import { sql, type Kysely } from 'kysely';

/**
 * Migración de cierre del modelo de identidad (C2 — RB1-16/RB1-19).
 *
 * El contrato `docs/contratos/auth-v1.md` exige dos piezas que el diccionario
 * §2.1–2.6 no recogía:
 *
 * 1. `usuario.debe_cambiar_password`, imprescindible para AC-SEC-15.
 * 2. `codigo_recuperacion_mfa`, para los 10 códigos de un solo uso de AC-SEC-07.
 *
 * También añade los índices de búsqueda de sesión. Es una **propuesta de
 * cambio para Rol A** (equivalente a R-030); se registra en el paquete de C2 y
 * no modifica el diccionario por decisión propia.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table public.usuario
      add column debe_cambiar_password boolean not null default false
  `.execute(db);

  await db.schema
    .createTable('codigo_recuperacion_mfa')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('usuario_id', 'uuid', (column) => column.notNull())
    .addColumn('codigo_hash', 'text', (column) => column.notNull())
    .addColumn('usado_en', 'timestamptz')
    .addColumn('creado_en', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addForeignKeyConstraint(
      'codigo_recuperacion_mfa_usuario_id_fkey',
      ['usuario_id'],
      'usuario',
      ['id'],
      (constraint) => constraint.onDelete('cascade'),
    )
    .execute();

  await db.schema
    .createIndex('codigo_recuperacion_mfa_usuario_usado_idx')
    .on('codigo_recuperacion_mfa')
    .columns(['usuario_id', 'usado_en'])
    .execute();

  await db.schema
    .createIndex('usuario_perfil_usuario_id_idx')
    .on('usuario_perfil')
    .columns(['usuario_id'])
    .execute();

  await db.schema
    .createIndex('refresh_token_token_hash_idx')
    .on('refresh_token')
    .columns(['token_hash'])
    .unique()
    .execute();

  await db.schema
    .createIndex('refresh_token_familia_id_idx')
    .on('refresh_token')
    .columns(['familia_id'])
    .execute();

  await db.schema
    .createIndex('refresh_token_usuario_familia_idx')
    .on('refresh_token')
    .columns(['usuario_id', 'familia_id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('refresh_token_usuario_familia_idx').ifExists().execute();
  await db.schema.dropIndex('refresh_token_familia_id_idx').ifExists().execute();
  await db.schema.dropIndex('refresh_token_token_hash_idx').ifExists().execute();
  await db.schema.dropIndex('usuario_perfil_usuario_id_idx').ifExists().execute();
  await db.schema.dropTable('codigo_recuperacion_mfa').ifExists().execute();
  await sql`alter table public.usuario drop column if exists debe_cambiar_password`.execute(db);
}
