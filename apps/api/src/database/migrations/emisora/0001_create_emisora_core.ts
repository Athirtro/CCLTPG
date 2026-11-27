import { sql, type Kysely } from 'kysely';

/**
 * Núcleo de la emisora (E1 — §4.1 "Convocatoria y participación").
 *
 * Todas las referencias a otros contextos (`usuario_id`, `programa_id`,
 * `formador_id`, `archivo_id`) son lógicas: se guardan como uuid y las resuelve
 * el contexto dueño mediante los puertos públicos (§2.2). Solo hay FK entre
 * tablas de `emisora`.
 *
 * La extensión `btree_gist` se crea aquí porque la migración 0004 necesita sus
 * clases de operadores para la restricción de exclusión de franjas. No se
 * elimina en `down`: la extensión vive en `public` y puede ser usada por otros
 * esquemas, así que borrarla rompería el principio aditivo (§17.3).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create extension if not exists btree_gist with schema public`.execute(db);

  await sql`create type emisora.convocatoria_estado as enum ('borrador', 'abierta', 'cerrada')`.execute(
    db,
  );
  await sql`create type emisora.proyecto_estado as enum ('recibido', 'en_revision', 'aprobado', 'rechazado')`.execute(
    db,
  );
  await sql`create type emisora.rejilla_estado as enum ('borrador', 'aprobada')`.execute(db);
  await sql`create type emisora.franja_tipo as enum ('programa', 'promo', 'mencion', 'espacio')`.execute(
    db,
  );

  await sql`
    create table emisora.convocatoria (
      id uuid primary key,
      anio smallint not null,
      fecha_apertura date not null,
      fecha_cierre date not null,
      estado emisora.convocatoria_estado not null default 'borrador',
      bases_archivo_id uuid,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now(),
      deleted_at timestamptz,
      constraint convocatoria_anio_key unique (anio),
      constraint convocatoria_plazo_check check (fecha_cierre = fecha_apertura + 21),
      constraint convocatoria_anio_check check (anio between 2000 and 2100)
    )
  `.execute(db);

  await sql`
    create table emisora.realizador (
      id uuid primary key,
      usuario_id uuid,
      nombres text not null,
      apellidos text not null,
      tipo_documento text not null,
      -- PII (§4.3): solo el cifrado y un HMAC ciego para búsqueda exacta.
      numero_documento_cifrado text not null,
      numero_documento_hash text not null,
      contacto_cifrado text,
      consentimiento_datos jsonb not null,
      municipio text,
      fecha_nacimiento date,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now(),
      deleted_at timestamptz,
      constraint realizador_documento_hash_key unique (numero_documento_hash),
      constraint realizador_documento_hash_check check (numero_documento_hash ~ '^[a-f0-9]{64}$')
    )
  `.execute(db);

  await sql`
    create table emisora.proyecto_programa (
      id uuid primary key,
      convocatoria_id uuid not null references emisora.convocatoria (id),
      realizador_id uuid not null references emisora.realizador (id),
      programa_id uuid,
      formador_id uuid,
      titulo text not null,
      -- RF-03.2: el formato oficial adjunto es obligatorio (referencia lógica).
      archivo_id uuid not null,
      fecha_recepcion date not null,
      estado emisora.proyecto_estado not null default 'recibido',
      observaciones text,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now(),
      deleted_at timestamptz,
      constraint proyecto_programa_archivo_check check (archivo_id is not null)
    )
  `.execute(db);

  await sql`
    create table emisora.comite (
      id uuid primary key,
      convocatoria_id uuid not null references emisora.convocatoria (id),
      fecha date not null,
      -- RF-03.3: la aprobación de la rejilla exige acta adjunta (validación de dominio).
      acta_archivo_id uuid,
      integrantes jsonb not null,
      conclusiones text,
      creado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table emisora.rejilla_anual (
      id uuid primary key,
      anio smallint not null,
      comite_id uuid references emisora.comite (id),
      estado emisora.rejilla_estado not null default 'borrador',
      aprobada_en timestamptz,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now(),
      constraint rejilla_anual_anio_key unique (anio),
      constraint rejilla_anual_aprobacion_check check (estado <> 'aprobada' or comite_id is not null)
    )
  `.execute(db);

  await sql`
    create table emisora.rejilla_anual_item (
      id uuid primary key,
      rejilla_anual_id uuid not null references emisora.rejilla_anual (id) on delete cascade,
      -- fecha para franjas fechadas; dia_semana para la rejilla semanal.
      fecha date,
      dia_semana smallint,
      hora_inicio time not null,
      hora_fin time not null,
      tipo emisora.franja_tipo not null default 'programa',
      programa_id uuid,
      nombre text not null,
      creado_en timestamptz not null default now(),
      constraint rejilla_item_hora_check check (hora_fin > hora_inicio),
      constraint rejilla_item_dia_check check (dia_semana between 1 and 7),
      constraint rejilla_item_marca_check check (fecha is not null or dia_semana is not null)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists emisora.rejilla_anual_item`.execute(db);
  await sql`drop table if exists emisora.rejilla_anual`.execute(db);
  await sql`drop table if exists emisora.comite`.execute(db);
  await sql`drop table if exists emisora.proyecto_programa`.execute(db);
  await sql`drop table if exists emisora.realizador`.execute(db);
  await sql`drop table if exists emisora.convocatoria`.execute(db);

  await sql`drop type if exists emisora.franja_tipo`.execute(db);
  await sql`drop type if exists emisora.rejilla_estado`.execute(db);
  await sql`drop type if exists emisora.proyecto_estado`.execute(db);
  await sql`drop type if exists emisora.convocatoria_estado`.execute(db);

  // btree_gist se conserva deliberadamente: no pertenece al ciclo de vida del
  // contexto emisora y otros esquemas pueden estar usándola (ver cabecera).
}
