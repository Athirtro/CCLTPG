import { sql, type Kysely } from 'kysely';

/**
 * Operación, derechos, tecnología y trámites (E1 — §4.1).
 *
 * `emisora.transmisor` es una tabla de apoyo necesaria para la semilla de un
 * transmisor de ejemplo (§11) y para las tres tablas de la sede; el resto de
 * las tablas de esta migración sigue la agrupación de §4.1. Las referencias a
 * usuarios, equipos externos, archivos y dependencias son lógicas (§2.2) salvo
 * cuando la tabla dueña también vive en `emisora`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create type emisora.turno_estado as enum ('planificado', 'confirmado', 'realizado')`.execute(
    db,
  );
  await sql`create type emisora.entidad_reporte as enum ('sayco', 'acinpro')`.execute(db);
  await sql`create type emisora.periodicidad_reporte as enum ('mensual', 'trimestral', 'semestral', 'anual')`.execute(
    db,
  );
  await sql`create type emisora.pago_estado as enum ('registrado', 'en_tramite')`.execute(db);
  await sql`
    create type emisora.equipo_estado as enum ('disponible', 'en_uso', 'mantenimiento', 'baja')
  `.execute(db);
  await sql`
    create type emisora.actualizacion_estado as enum ('solicitada', 'aprobada', 'rechazada', 'implementada')
  `.execute(db);
  await sql`create type emisora.proyeccion_estado as enum ('borrador', 'aprobada')`.execute(db);
  await sql`
    create type emisora.inversion_estado as enum ('proyectada', 'aprobada', 'en_seguimiento', 'cerrada')
  `.execute(db);
  await sql`create type emisora.asignacion_estado as enum ('asignado', 'devuelto')`.execute(db);
  await sql`create type emisora.permiso_estado as enum ('solicitado', 'emitido', 'negado')`.execute(
    db,
  );
  await sql`
    create type emisora.tramite_destino as enum ('gobierno', 'hacienda', 'saia', 'secretaria_tic', 'otro')
  `.execute(db);
  await sql`
    create type emisora.tramite_estado as enum ('radicado', 'en_tramite', 'respondido', 'archivado')
  `.execute(db);
  await sql`create type emisora.planilla_estado as enum ('borrador', 'registrada')`.execute(db);
  await sql`
    create type emisora.archivo_emisora_tipo as enum ('audio', 'documento', 'imagen', 'acta', 'formato')
  `.execute(db);

  await sql`
    create table emisora.transmisor (
      id uuid primary key,
      codigo text not null,
      nombre text not null,
      sede text not null,
      frecuencia text,
      activo boolean not null default true,
      creado_en timestamptz not null default now(),
      deleted_at timestamptz,
      constraint transmisor_codigo_key unique (codigo)
    )
  `.execute(db);

  await sql`
    create table emisora.turno_operador (
      id uuid primary key,
      transmisor_id uuid not null references emisora.transmisor (id),
      operador_id uuid not null,
      fecha date not null,
      hora_inicio time not null,
      hora_fin time not null,
      estado emisora.turno_estado not null default 'planificado',
      creado_en timestamptz not null default now(),
      constraint turno_operador_hora_check check (hora_fin > hora_inicio)
    )
  `.execute(db);

  await sql`
    create table emisora.lectura_transmisor (
      id uuid primary key,
      transmisor_id uuid not null references emisora.transmisor (id),
      fecha date not null,
      potencia_w integer,
      frecuencia text,
      observaciones text,
      registrado_por uuid not null,
      creado_en timestamptz not null default now(),
      constraint lectura_transmisor_transmisor_fecha_key unique (transmisor_id, fecha),
      constraint lectura_potencia_check check (potencia_w is null or potencia_w >= 0)
    )
  `.execute(db);

  await sql`
    create table emisora.bitacora_sede (
      id uuid primary key,
      transmisor_id uuid not null references emisora.transmisor (id),
      turno_id uuid references emisora.turno_operador (id),
      fecha date not null,
      incidente text not null,
      accion text,
      actor_id uuid not null,
      request_id uuid,
      ocurrido_en timestamptz not null default now(),
      creado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table emisora.parametro_reporte (
      id uuid primary key,
      entidad emisora.entidad_reporte not null,
      periodicidad emisora.periodicidad_reporte not null,
      dia_limite smallint not null,
      activo boolean not null default true,
      creado_en timestamptz not null default now(),
      constraint parametro_reporte_entidad_periodicidad_key unique (entidad, periodicidad),
      constraint parametro_reporte_dia_check check (dia_limite between 1 and 31)
    )
  `.execute(db);

  await sql`
    create table emisora.obra (
      id uuid primary key,
      titulo text not null,
      compositor_autor text not null,
      duracion_segundos integer not null,
      fecha_inclusion date not null,
      archivo_id uuid,
      creado_en timestamptz not null default now(),
      deleted_at timestamptz,
      constraint obra_duracion_check check (duracion_segundos > 0)
    )
  `.execute(db);

  await sql`
    create table emisora.reporte_obra (
      id uuid primary key,
      entidad emisora.entidad_reporte not null,
      periodo text not null,
      fecha_inicio date not null,
      fecha_fin date not null,
      archivo_id uuid,
      generado_en timestamptz not null default now(),
      creado_en timestamptz not null default now(),
      constraint reporte_obra_rango_check check (fecha_fin >= fecha_inicio)
    )
  `.execute(db);

  await sql`
    create table emisora.pago_derechos (
      id uuid primary key,
      obra_id uuid not null references emisora.obra (id),
      reporte_id uuid references emisora.reporte_obra (id),
      soporte_archivo_id uuid not null,
      referencia text not null,
      estado emisora.pago_estado not null default 'registrado',
      registrado_en timestamptz not null default now(),
      creado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table emisora.hoja_vida_equipo (
      id uuid primary key,
      nombre text not null,
      tipo text not null,
      marca text,
      modelo text,
      numero_serie text not null,
      estado emisora.equipo_estado not null default 'disponible',
      fecha_adquisicion date,
      archivo_id uuid,
      creado_en timestamptz not null default now(),
      deleted_at timestamptz,
      constraint hoja_vida_equipo_serie_key unique (numero_serie)
    )
  `.execute(db);

  await sql`
    create table emisora.actualizacion_tecnologica (
      id uuid primary key,
      equipo_id uuid not null references emisora.hoja_vida_equipo (id),
      descripcion text not null,
      solicitada_por uuid,
      estado emisora.actualizacion_estado not null default 'solicitada',
      fecha date,
      soporte_archivo_id uuid,
      creado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table emisora.proyeccion_anual (
      id uuid primary key,
      anio smallint not null,
      equipo_id uuid references emisora.hoja_vida_equipo (id),
      descripcion text not null,
      estado emisora.proyeccion_estado not null default 'borrador',
      archivo_id uuid,
      creado_en timestamptz not null default now(),
      constraint proyeccion_anual_anio_key unique (anio)
    )
  `.execute(db);

  await sql`
    create table emisora.inversion_seguimiento (
      id uuid primary key,
      proyeccion_id uuid not null references emisora.proyeccion_anual (id) on delete cascade,
      contrato_ref text,
      estado emisora.inversion_estado not null default 'proyectada',
      fecha_inicio date,
      fecha_fin date,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now(),
      constraint inversion_seguimiento_rango_check check (
        fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio
      )
    )
  `.execute(db);

  await sql`
    create table emisora.version_software (
      id uuid primary key,
      equipo_id uuid references emisora.hoja_vida_equipo (id),
      nombre text not null,
      version text not null,
      fecha_instalacion date not null,
      responsable_id uuid,
      creado_en timestamptz not null default now(),
      constraint version_software_nombre_version_key unique (nombre, version)
    )
  `.execute(db);

  await sql`
    create table emisora.asignacion_equipo (
      id uuid primary key,
      equipo_id uuid not null references emisora.hoja_vida_equipo (id),
      transmisor_id uuid references emisora.transmisor (id),
      usuario_id uuid,
      fecha_asignacion date not null,
      fecha_devolucion date,
      estado emisora.asignacion_estado not null default 'asignado',
      creado_en timestamptz not null default now(),
      constraint asignacion_equipo_devolucion_check check (
        fecha_devolucion is null or fecha_devolucion >= fecha_asignacion
      )
    )
  `.execute(db);

  await sql`
    create table emisora.actividad_cultural (
      id uuid primary key,
      nombre text not null,
      fecha date not null,
      lugar text,
      descripcion text,
      responsable_id uuid,
      publicada boolean not null default false,
      archivo_id uuid,
      creado_en timestamptz not null default now(),
      deleted_at timestamptz
    )
  `.execute(db);

  await sql`
    create table emisora.permiso_gobierno (
      id uuid primary key,
      actividad_id uuid not null references emisora.actividad_cultural (id),
      oficio_archivo_id uuid not null,
      destino text,
      fecha_emision date,
      estado emisora.permiso_estado not null default 'solicitado',
      creado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table emisora.tramite_externo (
      id uuid primary key,
      destino emisora.tramite_destino not null,
      asunto text not null,
      radicado_ref text,
      estado emisora.tramite_estado not null default 'radicado',
      fecha_radicacion date not null,
      responsable_id uuid,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table emisora.soporte_tramite (
      id uuid primary key,
      tramite_id uuid not null references emisora.tramite_externo (id) on delete cascade,
      archivo_id uuid not null,
      tipo text,
      descripcion text,
      creado_en timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    create table emisora.planilla_emision (
      id uuid primary key,
      fecha date not null,
      programacion_diaria_id uuid references emisora.programacion_diaria (id),
      operador_id uuid,
      archivo_id uuid,
      estado emisora.planilla_estado not null default 'borrador',
      creado_en timestamptz not null default now(),
      constraint planilla_emision_fecha_key unique (fecha)
    )
  `.execute(db);

  await sql`
    create table emisora.archivo_emisora (
      id uuid primary key,
      -- Referencia lógica al contexto Archivos; el binario no se duplica (§4.1).
      archivo_id uuid not null,
      tipo emisora.archivo_emisora_tipo not null,
      duracion_segundos integer,
      fecha date not null,
      responsable_id uuid not null,
      hash_sha256 text,
      mime text,
      creado_en timestamptz not null default now(),
      deleted_at timestamptz,
      constraint archivo_emisora_archivo_key unique (archivo_id),
      constraint archivo_emisora_duracion_check check (duracion_segundos is null or duracion_segundos > 0)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists emisora.archivo_emisora`.execute(db);
  await sql`drop table if exists emisora.planilla_emision`.execute(db);
  await sql`drop table if exists emisora.soporte_tramite`.execute(db);
  await sql`drop table if exists emisora.tramite_externo`.execute(db);
  await sql`drop table if exists emisora.permiso_gobierno`.execute(db);
  await sql`drop table if exists emisora.actividad_cultural`.execute(db);
  await sql`drop table if exists emisora.asignacion_equipo`.execute(db);
  await sql`drop table if exists emisora.version_software`.execute(db);
  await sql`drop table if exists emisora.inversion_seguimiento`.execute(db);
  await sql`drop table if exists emisora.proyeccion_anual`.execute(db);
  await sql`drop table if exists emisora.actualizacion_tecnologica`.execute(db);
  await sql`drop table if exists emisora.hoja_vida_equipo`.execute(db);
  await sql`drop table if exists emisora.pago_derechos`.execute(db);
  await sql`drop table if exists emisora.reporte_obra`.execute(db);
  await sql`drop table if exists emisora.obra`.execute(db);
  await sql`drop table if exists emisora.parametro_reporte`.execute(db);
  await sql`drop table if exists emisora.bitacora_sede`.execute(db);
  await sql`drop table if exists emisora.lectura_transmisor`.execute(db);
  await sql`drop table if exists emisora.turno_operador`.execute(db);
  await sql`drop table if exists emisora.transmisor`.execute(db);

  await sql`drop type if exists emisora.archivo_emisora_tipo`.execute(db);
  await sql`drop type if exists emisora.planilla_estado`.execute(db);
  await sql`drop type if exists emisora.tramite_estado`.execute(db);
  await sql`drop type if exists emisora.tramite_destino`.execute(db);
  await sql`drop type if exists emisora.permiso_estado`.execute(db);
  await sql`drop type if exists emisora.asignacion_estado`.execute(db);
  await sql`drop type if exists emisora.inversion_estado`.execute(db);
  await sql`drop type if exists emisora.proyeccion_estado`.execute(db);
  await sql`drop type if exists emisora.actualizacion_estado`.execute(db);
  await sql`drop type if exists emisora.equipo_estado`.execute(db);
  await sql`drop type if exists emisora.pago_estado`.execute(db);
  await sql`drop type if exists emisora.periodicidad_reporte`.execute(db);
  await sql`drop type if exists emisora.entidad_reporte`.execute(db);
  await sql`drop type if exists emisora.turno_estado`.execute(db);
}
