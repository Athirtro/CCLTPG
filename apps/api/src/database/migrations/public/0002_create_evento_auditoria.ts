import { sql, type Kysely } from 'kysely';

/**
 * Migración del registro de auditoría (C2 — RB1-15, control C-28 / AC-AUD-06).
 *
 * Crea `public.evento_auditoria` con el modelo de la propuesta
 * `docs/contratos/modelo-auditoria-v1.md`: actor, perfil, IP, dispositivo,
 * recurso, recurso_id, acción, datos antes/después (jsonb) y correlación con
 * `requestId`. Implementa el principio de **solo inserción**.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('evento_auditoria')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('actor_id', 'uuid')
    .addColumn('actor_perfil', 'text')
    .addColumn('ip', sql`inet`)
    .addColumn('dispositivo', 'text')
    .addColumn('recurso', 'text', (column) => column.notNull())
    .addColumn('recurso_id', 'uuid')
    .addColumn('accion', 'text', (column) => column.notNull())
    .addColumn('datos_antes', 'jsonb')
    .addColumn('datos_despues', 'jsonb')
    .addColumn('ocurrido_en', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('request_id', 'text')
    .addCheckConstraint('evento_auditoria_accion_check', sql`accion ~ '^[a-z_]+\.[a-z_]+$'`)
    .execute();

  await sql`revoke update, delete on public.evento_auditoria from ccltpg_app`.execute(db);
  await sql`revoke truncate on public.evento_auditoria from ccltpg_app`.execute(db);
  await sql`grant select, insert on public.evento_auditoria to ccltpg_app`.execute(db);
  await sql`grant select on public.evento_auditoria to ccltpg_readonly`.execute(db);

  await sql`
    create or replace function public.auditoria_solo_insercion()
      returns trigger
      language plpgsql
      as $$
    begin
      raise exception 'public.evento_auditoria es de solo inserción'
        using errcode = 'insufficient_privilege';
    end;
    $$;
  `.execute(db);

  await sql`
    create trigger trg_auditoria_no_update_delete
      before update or delete on public.evento_auditoria
      for each row execute function public.auditoria_solo_insercion();
  `.execute(db);

  await sql`
    create trigger trg_auditoria_no_truncate
      before truncate on public.evento_auditoria
      for each statement execute function public.auditoria_solo_insercion();
  `.execute(db);

  await db.schema
    .createIndex('evento_auditoria_ocurrencia_en_idx')
    .on('evento_auditoria')
    .columns(['ocurrido_en'])
    .execute();

  await db.schema
    .createIndex('evento_auditoria_actor_ocurrencia_idx')
    .on('evento_auditoria')
    .columns(['actor_id', 'ocurrido_en'])
    .execute();

  await db.schema
    .createIndex('evento_auditoria_recurso_ocurrencia_idx')
    .on('evento_auditoria')
    .columns(['recurso', 'recurso_id', 'ocurrido_en'])
    .execute();

  await db.schema
    .createIndex('evento_auditoria_accion_ocurrencia_idx')
    .on('evento_auditoria')
    .columns(['accion', 'ocurrido_en'])
    .execute();

  await db.schema
    .createIndex('evento_auditoria_request_id_idx')
    .on('evento_auditoria')
    .columns(['request_id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop trigger if exists trg_auditoria_no_truncate on public.evento_auditoria`.execute(
    db,
  );
  await sql`drop trigger if exists trg_auditoria_no_update_delete on public.evento_auditoria`.execute(
    db,
  );

  await sql`drop function if exists public.auditoria_solo_insercion`.execute(db);

  await db.schema.dropTable('evento_auditoria').execute();
}
