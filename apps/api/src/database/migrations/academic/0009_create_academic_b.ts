import { sql, type Kysely } from 'kysely';

/**
 * Fundaciones de Académico B (C5 — RB1-37, D70).
 *
 * Crea las tablas del diccionario §3.6–3.9 en el esquema `academic`. Como en
 * C4, las referencias a usuarios son lógicas: no hay FK cruzadas a `public`.
 * La escala de evaluación queda cerrada por decisión D73.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create type academic.sesion_estado as enum ('programada', 'realizada', 'cancelada')`.execute(
    db,
  );
  await sql`create type academic.asistencia_estado as enum ('presente', 'ausente', 'tarde', 'excusa')`.execute(
    db,
  );
  await sql`create type academic.evaluacion_valor as enum ('excelente', 'bueno', 'regular', 'deficiente')`.execute(
    db,
  );

  await sql`
    create table academic.sesion_clase (
      id uuid primary key,
      grupo_id uuid not null references academic.grupo (id),
      fecha date not null,
      tema text,
      estado academic.sesion_estado not null default 'programada',
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table academic.asistencia (
      id uuid primary key,
      sesion_id uuid not null references academic.sesion_clase (id) on delete cascade,
      matricula_id uuid not null references academic.matricula (id),
      estado academic.asistencia_estado not null,
      registrado_por uuid not null,
      registrado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table academic.indicador_evaluacion (
      id uuid primary key,
      programa_id uuid references academic.programa_formativo (id),
      nombre text not null,
      descripcion text,
      escala text not null default 'excelente,bueno,regular,deficiente',
      creado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table academic.evaluacion_cualitativa (
      id uuid primary key,
      matricula_id uuid not null references academic.matricula (id),
      indicador_id uuid not null references academic.indicador_evaluacion (id),
      periodo text not null,
      valor academic.evaluacion_valor not null,
      observacion text,
      evaluado_por uuid not null,
      evaluado_en timestamptz not null default now(),
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now()
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists academic.evaluacion_cualitativa`.execute(db);
  await sql`drop table if exists academic.indicador_evaluacion`.execute(db);
  await sql`drop table if exists academic.asistencia`.execute(db);
  await sql`drop table if exists academic.sesion_clase`.execute(db);
  await sql`drop type if exists academic.evaluacion_valor`.execute(db);
  await sql`drop type if exists academic.asistencia_estado`.execute(db);
  await sql`drop type if exists academic.sesion_estado`.execute(db);
}
