import { sql, type Kysely } from 'kysely';

/**
 * Migración del núcleo de identidad y sesión (C2 — RB1-15).
 *
 * Crea el esquema de identidad mínima del diseño §7.2 del documento de
 * arquitectura: `usuario`, catálogo de `perfil`/`permiso` con su relación y
 * `usuario_perfil` (incluidas las identidades temporales), más los
 * `refresh_token` de rotación con detección de reutilización.
 *
 * Las tablas de negocio académico (`academic`) se crean en C4 con RC-A-01…04.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createType('usuario_estado')
    .asEnum(['activo', 'inactivo', 'bloqueado'])
    .execute();

  await db.schema
    .createTable('usuario')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('email', 'text', (column) => column.notNull().unique())
    .addColumn('password_hash', 'text', (column) => column.notNull())
    .addColumn('nombre', 'text', (column) => column.notNull())
    .addColumn('estado', sql`usuario_estado`, (column) => column.notNull())
    .addColumn('mfa_habilitado', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('mfa_secret_cifrado', 'text')
    .addColumn('creado_en', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('actualizado_en', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('perfil')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('codigo', 'text', (column) => column.notNull().unique())
    .addColumn('nombre', 'text', (column) => column.notNull())
    .addColumn('descripcion', 'text')
    .execute();

  await db.schema
    .createTable('permiso')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('codigo', 'text', (column) => column.notNull().unique())
    .addColumn('descripcion', 'text')
    .execute();

  await db.schema
    .createTable('perfil_permiso')
    .addColumn('perfil_id', 'uuid', (column) => column.notNull())
    .addColumn('permiso_id', 'uuid', (column) => column.notNull())
    .addPrimaryKeyConstraint('perfil_permiso_perfil_id_permiso_id_pkey', [
      'perfil_id',
      'permiso_id',
    ])
    .addForeignKeyConstraint(
      'perfil_permiso_perfil_id_permiso_id_perfil_id_fkey',
      ['perfil_id'],
      'perfil',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'perfil_permiso_perfil_id_permiso_id_permiso_id_fkey',
      ['permiso_id'],
      'permiso',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .execute();

  await db.schema
    .createTable('usuario_perfil')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('usuario_id', 'uuid', (column) => column.notNull())
    .addColumn('perfil_id', 'uuid', (column) => column.notNull())
    .addColumn('valid_until', 'timestamptz')
    .addColumn('asignado_por', 'uuid')
    .addColumn('creado_en', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addForeignKeyConstraint(
      'usuario_perfil_usuario_id_fkey',
      ['usuario_id'],
      'usuario',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'usuario_perfil_perfil_id_fkey',
      ['perfil_id'],
      'perfil',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .execute();

  await db.schema
    .createTable('refresh_token')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('usuario_id', 'uuid', (column) => column.notNull())
    .addColumn('token_hash', 'text', (column) => column.notNull())
    .addColumn('familia_id', 'uuid', (column) => column.notNull())
    .addColumn('expira_en', 'timestamptz', (column) => column.notNull())
    .addColumn('revocado_en', 'timestamptz')
    .addColumn('reemplazado_por', 'uuid')
    .addColumn('ip', sql`inet`)
    .addColumn('user_agent', 'text')
    .addForeignKeyConstraint(
      'refresh_token_usuario_id_fkey',
      ['usuario_id'],
      'usuario',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('refresh_token').execute();
  await db.schema.dropTable('usuario_perfil').execute();
  await db.schema.dropTable('perfil_permiso').execute();
  await db.schema.dropTable('permiso').execute();
  await db.schema.dropTable('perfil').execute();
  await db.schema.dropTable('usuario').execute();
  await db.schema.dropType('usuario_estado').ifExists().execute();
}
