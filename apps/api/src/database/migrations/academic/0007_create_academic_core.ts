import { sql, type Kysely } from 'kysely';

/**
 * Migración del núcleo académico (C4 — RB1-28).
 *
 * Crea las tablas del diccionario §3.1–3.5 en el esquema `academic`. Las
 * referencias a `public.usuario` son lógicas (sin FK cruzada, §5).
 *
 * Extensiones ratificadas para C4 (R-034):
 * - `grupo.cupo_maximo`: el cupo se controla por grupo, no solo por programa.
 * - `estudiante.numero_documento_hash`: índice ciego HMAC para búsqueda exacta.
 * - `estudiante.usuario_id` único parcial (varias filas sin vínculo permitidas).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create type academic.programa_area as enum ('danza', 'musica', 'teatro', 'artes_plasticas')`.execute(
    db,
  );
  await sql`create type academic.programa_estado as enum ('borrador', 'publicado', 'archivado')`.execute(
    db,
  );
  await sql`create type academic.grupo_estado as enum ('abierto', 'cerrado')`.execute(db);
  await sql`create type academic.matricula_estado as enum ('preinscrita', 'confirmada', 'activa', 'finalizada', 'cancelada', 'retirada')`.execute(
    db,
  );

  await sql`
    create table academic.programa_formativo (
      id uuid primary key,
      nombre text not null,
      descripcion text,
      area academic.programa_area not null,
      cupo_maximo integer not null,
      estado academic.programa_estado not null default 'borrador',
      creado_en timestamptz not null default now(),
      constraint programa_formativo_cupo_check check (cupo_maximo > 0)
    )
  `.execute(db);

  await sql`
    create table academic.grupo (
      id uuid primary key,
      programa_id uuid not null references academic.programa_formativo (id),
      codigo text not null,
      educador_id uuid not null,
      salon text,
      periodo text not null,
      cupo_maximo integer not null,
      estado academic.grupo_estado not null default 'abierto',
      creado_en timestamptz not null default now(),
      constraint grupo_cupo_check check (cupo_maximo > 0),
      constraint grupo_periodo_check check (periodo ~ '^[0-9]{4}-[0-9]+$'),
      constraint grupo_codigo_periodo_key unique (periodo, codigo)
    )
  `.execute(db);

  await sql`
    create table academic.horario_grupo (
      id uuid primary key,
      grupo_id uuid not null references academic.grupo (id) on delete cascade,
      dia_semana smallint not null,
      hora_inicio time not null,
      hora_fin time not null,
      constraint horario_dia_check check (dia_semana between 1 and 7),
      constraint horario_rango_check check (hora_fin > hora_inicio)
    )
  `.execute(db);

  await sql`
    create table academic.estudiante (
      id uuid primary key,
      usuario_id uuid,
      tipo_documento text not null,
      numero_documento text not null,
      numero_documento_hash text not null,
      nombres text not null,
      apellidos text not null,
      fecha_nacimiento date,
      municipio text,
      barrio text,
      direccion text,
      telefono text,
      acudiente jsonb,
      consentimiento_datos jsonb not null,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now(),
      constraint estudiante_documento_hash_key unique (numero_documento_hash),
      constraint estudiante_documento_hash_check check (numero_documento_hash ~ '^[a-f0-9]{64}$')
    )
  `.execute(db);

  await sql`create unique index estudiante_usuario_unique on academic.estudiante (usuario_id) where usuario_id is not null`.execute(
    db,
  );

  await sql`
    create table academic.matricula (
      id uuid primary key,
      estudiante_id uuid not null references academic.estudiante (id),
      grupo_id uuid not null references academic.grupo (id),
      estado academic.matricula_estado not null default 'preinscrita',
      fecha_matricula timestamptz not null default now(),
      periodo text not null,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now(),
      constraint matricula_periodo_check check (periodo ~ '^[0-9]{4}-[0-9]+$')
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists academic.matricula`.execute(db);
  await sql`drop table if exists academic.estudiante`.execute(db);
  await sql`drop table if exists academic.horario_grupo`.execute(db);
  await sql`drop table if exists academic.grupo`.execute(db);
  await sql`drop table if exists academic.programa_formativo`.execute(db);
  await sql`drop type if exists academic.matricula_estado`.execute(db);
  await sql`drop type if exists academic.grupo_estado`.execute(db);
  await sql`drop type if exists academic.programa_estado`.execute(db);
  await sql`drop type if exists academic.programa_area`.execute(db);
}
