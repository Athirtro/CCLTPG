import { sql, type Kysely } from 'kysely';

/**
 * Migración de idempotencia y outbox (C3 — RB1-20/RB1-25).
 *
 * Dos piezas transversales propuestas a Rol A:
 * - **R-032** `public.idempotency_key`: repetición segura de creaciones con
 *   `Idempotency-Key` (AC-SEC-30) con hash canónico del cuerpo.
 * - **R-033** `public.evento_outbox`: publicación transaccional de eventos de
 *   dominio y entrega con reintentos (D53). La outbox se escribe en la misma
 *   transacción que el cambio; un trabajador en proceso la consume.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('idempotency_key')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('usuario_id', 'uuid', (column) => column.notNull())
    .addColumn('operacion', 'text', (column) => column.notNull())
    .addColumn('clave', 'text', (column) => column.notNull())
    .addColumn('hash_solicitud', 'text', (column) => column.notNull())
    .addColumn('estado', 'text', (column) => column.notNull().defaultTo('en_proceso'))
    .addColumn('respuesta_status', 'integer')
    .addColumn('respuesta_cuerpo', 'jsonb')
    .addColumn('creado_en', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('expira_en', 'timestamptz', (column) => column.notNull())
    .addUniqueConstraint('idempotency_key_usuario_operacion_clave_key', [
      'usuario_id',
      'operacion',
      'clave',
    ])
    .addCheckConstraint('idempotency_key_estado_check', sql`estado in ('en_proceso', 'completada')`)
    .addCheckConstraint('idempotency_key_hash_check', sql`hash_solicitud ~ '^[a-f0-9]{64}$'`)
    .execute();

  await db.schema
    .createIndex('idempotency_key_expira_idx')
    .on('idempotency_key')
    .columns(['expira_en'])
    .execute();

  await db.schema
    .createTable('evento_outbox')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('agregado', 'text', (column) => column.notNull())
    .addColumn('tipo', 'text', (column) => column.notNull())
    .addColumn('payload', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('estado', 'text', (column) => column.notNull().defaultTo('pendiente'))
    .addColumn('intentos', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('disponible_en', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('creado_en', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('procesado_en', 'timestamptz')
    .addColumn('ultimo_error', 'text')
    .addCheckConstraint(
      'evento_outbox_estado_check',
      sql`estado in ('pendiente', 'procesando', 'procesada', 'fallida')`,
    )
    .addCheckConstraint('evento_outbox_intentos_check', sql`intentos >= 0`)
    .execute();

  await db.schema
    .createIndex('evento_outbox_estado_disponible_idx')
    .on('evento_outbox')
    .columns(['estado', 'disponible_en'])
    .execute();

  await db.schema
    .createIndex('evento_outbox_creado_idx')
    .on('evento_outbox')
    .columns(['creado_en'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('evento_outbox_creado_idx').ifExists().execute();
  await db.schema.dropIndex('evento_outbox_estado_disponible_idx').ifExists().execute();
  await db.schema.dropTable('evento_outbox').ifExists().execute();
  await db.schema.dropIndex('idempotency_key_expira_idx').ifExists().execute();
  await db.schema.dropTable('idempotency_key').ifExists().execute();
}
