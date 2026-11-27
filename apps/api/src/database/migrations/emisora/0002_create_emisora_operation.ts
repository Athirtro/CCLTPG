import { sql, type Kysely } from 'kysely';

/**
 * Operación de la emisora (E1 — §4.1: programación, grabación, seguimiento,
 * patrocinios, promos y transmisiones).
 *
 * Los instantes se guardan como `timestamptz` y las fechas de calendario como
 * `date` (§4.4). Las transiciones de estado se validan en dominio con
 * `SELECT ... FOR UPDATE`; aquí solo se fijan los estados permitidos y las
 * restricciones que no dependen de otras tablas.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create type emisora.programacion_estado as enum ('borrador', 'aprobada')`.execute(db);
  await sql`create type emisora.asistencia_estado as enum ('presente', 'ausente', 'tarde', 'excusa')`.execute(
    db,
  );
  await sql`create type emisora.grabacion_estado as enum ('programada', 'realizada', 'aprobada', 'cancelada')`.execute(
    db,
  );
  await sql`
    create type emisora.audio_tipo as enum ('programa', 'entrevista', 'promo', 'cotidiano')
  `.execute(db);
  await sql`create type emisora.informe_estado as enum ('recibido', 'evaluado')`.execute(db);
  await sql`
    create type emisora.incentivo_estado as enum ('calificado', 'asignado', 'resuelto', 'solicitud_cdp')
  `.execute(db);
  await sql`
    create type emisora.patrocinio_estado as enum ('propuesto', 'aprobado', 'rechazado')
  `.execute(db);
  await sql`create type emisora.promo_estado as enum ('borrador', 'producida')`.execute(db);
  await sql`create type emisora.orden_emision_estado as enum ('borrador', 'programada', 'emitida')`.execute(
    db,
  );
  await sql`create type emisora.publicacion_estado as enum ('programada', 'publicada')`.execute(db);
  await sql`
    create type emisora.transmision_estado as enum ('programada', 'autorizada', 'realizada', 'cancelada')
  `.execute(db);
  await sql`
    create type emisora.prestamo_estado as enum ('solicitado', 'autorizado', 'entregado', 'devuelto', 'rechazado')
  `.execute(db);
  await sql`
    create type emisora.viatico_estado as enum ('solicitado', 'resuelto', 'comprometido', 'orden_generada')
  `.execute(db);

  await sql`
    create table emisora.programacion_diaria (
      id uuid primary key,
      rejilla_anual_id uuid not null references emisora.rejilla_anual (id),
      fecha date not null,
      estado emisora.programacion_estado not null default 'borrador',
      concuerda boolean,
      desviaciones jsonb,
      responsable_id uuid,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now(),
      constraint programacion_diaria_fecha_key unique (fecha)
    )
  `.execute(db);

  await sql`
    create table emisora.programacion_item (
      id uuid primary key,
      programacion_diaria_id uuid not null references emisora.programacion_diaria (id) on delete cascade,
      fecha date not null,
      hora_inicio time not null,
      hora_fin time not null,
      tipo emisora.franja_tipo not null default 'programa',
      programa_id uuid,
      -- Referencia lógica a emisora.promo (creada más abajo en esta migración).
      promo_id uuid,
      titulo text not null,
      creado_en timestamptz not null default now(),
      constraint programacion_item_hora_check check (hora_fin > hora_inicio)
    )
  `.execute(db);

  await sql`
    create table emisora.sesion_grabacion (
      id uuid primary key,
      programacion_item_id uuid references emisora.programacion_item (id),
      fecha date not null,
      estado emisora.grabacion_estado not null default 'programada',
      responsable_id uuid,
      aprobada_por uuid,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table emisora.audio (
      id uuid primary key,
      sesion_grabacion_id uuid not null references emisora.sesion_grabacion (id),
      tipo emisora.audio_tipo not null,
      duracion_segundos integer not null,
      fecha date not null,
      responsable_id uuid not null,
      archivo_id uuid not null,
      hash_sha256 text,
      creado_en timestamptz not null default now(),
      deleted_at timestamptz,
      constraint audio_duracion_check check (duracion_segundos > 0)
    )
  `.execute(db);

  await sql`
    create table emisora.asistencia_cabina (
      id uuid primary key,
      sesion_id uuid not null references emisora.sesion_grabacion (id) on delete cascade,
      usuario_id uuid not null,
      estado emisora.asistencia_estado not null default 'presente',
      registrado_en timestamptz not null default now(),
      constraint asistencia_cabina_sesion_usuario_key unique (sesion_id, usuario_id)
    )
  `.execute(db);

  await sql`
    create table emisora.informe_realizador (
      id uuid primary key,
      proyecto_id uuid not null references emisora.proyecto_programa (id),
      realizador_id uuid not null references emisora.realizador (id),
      fecha_informe date not null,
      estado emisora.informe_estado not null default 'recibido',
      archivo_id uuid not null,
      calificacion smallint,
      observaciones text,
      evaluado_por uuid,
      evaluado_en timestamptz,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now(),
      -- RF-03.5: ventana oct/nov sobre date (§4.4, inclusive).
      constraint informe_ventana_check check (extract(month from fecha_informe) between 10 and 11),
      constraint informe_calificacion_check check (calificacion between 0 and 100)
    )
  `.execute(db);

  await sql`
    create table emisora.incentivo (
      id uuid primary key,
      informe_id uuid not null references emisora.informe_realizador (id),
      comite_id uuid references emisora.comite (id),
      realizador_id uuid not null references emisora.realizador (id),
      estado emisora.incentivo_estado not null default 'calificado',
      calificacion smallint,
      referencia_cdp text,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now(),
      constraint incentivo_calificacion_check check (calificacion between 0 and 100)
    )
  `.execute(db);

  await sql`
    create table emisora.resolucion_incentivo (
      id uuid primary key,
      incentivo_id uuid not null references emisora.incentivo (id),
      pdf_archivo_id uuid not null,
      referencia_cdp text not null,
      emitida_en timestamptz not null default now(),
      creado_en timestamptz not null default now(),
      constraint resolucion_incentivo_incentivo_key unique (incentivo_id)
    )
  `.execute(db);

  await sql`
    create table emisora.patrocinio (
      id uuid primary key,
      nombre text not null,
      entidad text not null,
      estado emisora.patrocinio_estado not null default 'propuesto',
      fecha_inicio date,
      fecha_fin date,
      contrato_archivo_id uuid,
      creado_en timestamptz not null default now(),
      deleted_at timestamptz,
      constraint patrocinio_vigencia_check check (
        fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio
      )
    )
  `.execute(db);

  await sql`
    create table emisora.promo (
      id uuid primary key,
      patrocinio_id uuid references emisora.patrocinio (id),
      nombre text not null,
      guion text,
      duracion_segundos integer not null,
      audio_archivo_id uuid,
      estado emisora.promo_estado not null default 'borrador',
      creado_en timestamptz not null default now(),
      deleted_at timestamptz,
      constraint promo_duracion_check check (duracion_segundos > 0)
    )
  `.execute(db);

  await sql`
    create table emisora.orden_emision (
      id uuid primary key,
      promo_id uuid not null references emisora.promo (id),
      programacion_item_id uuid references emisora.programacion_item (id),
      estado emisora.orden_emision_estado not null default 'borrador',
      fecha_emision date,
      emitida_en timestamptz,
      creado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table emisora.publicacion (
      id uuid primary key,
      promo_id uuid references emisora.promo (id),
      canal text not null,
      fecha_publicacion date not null,
      publicada_en timestamptz,
      estado emisora.publicacion_estado not null default 'programada',
      archivo_id uuid,
      creado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table emisora.transmision (
      id uuid primary key,
      programacion_item_id uuid references emisora.programacion_item (id),
      fecha_transmision date not null,
      es_fuera_ciudad boolean not null default false,
      destino text,
      estado emisora.transmision_estado not null default 'programada',
      autorizada_por uuid,
      autorizada_en timestamptz,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table emisora.salida_equipo (
      id uuid primary key,
      transmision_id uuid not null references emisora.transmision (id) on delete cascade,
      equipo_id uuid not null,
      responsable_id uuid not null,
      fecha_salida timestamptz not null default now(),
      fecha_devolucion timestamptz,
      observaciones text,
      creado_en timestamptz not null default now(),
      constraint salida_equipo_devolucion_check check (fecha_devolucion is null or fecha_devolucion >= fecha_salida)
    )
  `.execute(db);

  await sql`
    create table emisora.reporte_desplazamiento (
      id uuid primary key,
      transmision_id uuid not null references emisora.transmision (id) on delete cascade,
      conductor_id uuid,
      vehiculo text not null,
      hora_salida timestamptz,
      hora_llegada timestamptz,
      novedades text,
      creado_en timestamptz not null default now(),
      constraint reporte_desplazamiento_rango_check check (
        hora_llegada is null or hora_salida is null or hora_llegada >= hora_salida
      )
    )
  `.execute(db);

  await sql`
    create table emisora.prestamo_mifi (
      id uuid primary key,
      transmision_id uuid not null references emisora.transmision (id),
      usuario_id uuid not null,
      fecha_solicitud timestamptz not null,
      fecha_transmision date not null,
      estado emisora.prestamo_estado not null default 'solicitado',
      observaciones text,
      creado_en timestamptz not null default now(),
      -- RF-06.5 (§4.4): dos días calendario de antelación en America/Bogota.
      constraint prestamo_mifi_antelacion_check check (
        (fecha_solicitud at time zone 'America/Bogota')::date <= fecha_transmision - 2
      )
    )
  `.execute(db);

  await sql`
    create table emisora.viatico (
      id uuid primary key,
      transmision_id uuid not null references emisora.transmision (id),
      usuario_id uuid not null,
      estado emisora.viatico_estado not null default 'solicitado',
      -- Solo trazabilidad: referencias externas, sin importes ni ejecución (P7).
      referencia_compromiso text,
      referencia_orden text,
      soporte_archivo_id uuid,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now()
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists emisora.viatico`.execute(db);
  await sql`drop table if exists emisora.prestamo_mifi`.execute(db);
  await sql`drop table if exists emisora.reporte_desplazamiento`.execute(db);
  await sql`drop table if exists emisora.salida_equipo`.execute(db);
  await sql`drop table if exists emisora.transmision`.execute(db);
  await sql`drop table if exists emisora.publicacion`.execute(db);
  await sql`drop table if exists emisora.orden_emision`.execute(db);
  await sql`drop table if exists emisora.promo`.execute(db);
  await sql`drop table if exists emisora.patrocinio`.execute(db);
  await sql`drop table if exists emisora.resolucion_incentivo`.execute(db);
  await sql`drop table if exists emisora.incentivo`.execute(db);
  await sql`drop table if exists emisora.informe_realizador`.execute(db);
  await sql`drop table if exists emisora.asistencia_cabina`.execute(db);
  await sql`drop table if exists emisora.audio`.execute(db);
  await sql`drop table if exists emisora.sesion_grabacion`.execute(db);
  await sql`drop table if exists emisora.programacion_item`.execute(db);
  await sql`drop table if exists emisora.programacion_diaria`.execute(db);

  await sql`drop type if exists emisora.viatico_estado`.execute(db);
  await sql`drop type if exists emisora.prestamo_estado`.execute(db);
  await sql`drop type if exists emisora.transmision_estado`.execute(db);
  await sql`drop type if exists emisora.publicacion_estado`.execute(db);
  await sql`drop type if exists emisora.orden_emision_estado`.execute(db);
  await sql`drop type if exists emisora.promo_estado`.execute(db);
  await sql`drop type if exists emisora.patrocinio_estado`.execute(db);
  await sql`drop type if exists emisora.incentivo_estado`.execute(db);
  await sql`drop type if exists emisora.informe_estado`.execute(db);
  await sql`drop type if exists emisora.audio_tipo`.execute(db);
  await sql`drop type if exists emisora.grabacion_estado`.execute(db);
  await sql`drop type if exists emisora.asistencia_estado`.execute(db);
  await sql`drop type if exists emisora.programacion_estado`.execute(db);
}
