import { sql, type Kysely } from 'kysely';

/**
 * Índices y restricciones de exclusión de la emisora (E1 — §4.1/§11).
 *
 * RF-01.1 prohíbe solapar franjas en la misma fecha. La regla se impone con una
 * restricción de exclusión `gist`: requiere `btree_gist` para la igualdad de
 * uuid/date, creada en `0001` y conservada en el `down` por ser compartida.
 * Las consultas por rejilla, grabación, transmisión y trámites se cubren con
 * índices compuestos; el `down` elimina exactamente estos objetos.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create index convocatoria_estado_cierre_idx
      on emisora.convocatoria (estado, fecha_cierre)
  `.execute(db);
  await sql`
    create index realizador_usuario_idx
      on emisora.realizador (usuario_id) where usuario_id is not null
  `.execute(db);
  await sql`
    create index proyecto_convocatoria_estado_idx
      on emisora.proyecto_programa (convocatoria_id, estado)
  `.execute(db);
  await sql`create index proyecto_realizador_idx on emisora.proyecto_programa (realizador_id)`.execute(
    db,
  );
  await sql`
    create index rejilla_item_rejilla_dia_idx
      on emisora.rejilla_anual_item (rejilla_anual_id, dia_semana, hora_inicio)
  `.execute(db);
  await sql`
    create index programacion_diaria_rejilla_fecha_idx
      on emisora.programacion_diaria (rejilla_anual_id, fecha)
  `.execute(db);
  await sql`
    create index programacion_item_fecha_hora_idx
      on emisora.programacion_item (fecha, hora_inicio)
  `.execute(db);
  await sql`
    create index sesion_grabacion_fecha_estado_idx
      on emisora.sesion_grabacion (fecha, estado)
  `.execute(db);
  await sql`create index audio_sesion_idx on emisora.audio (sesion_grabacion_id)`.execute(db);
  await sql`create index incentivo_estado_idx on emisora.incentivo (estado)`.execute(db);
  await sql`
    create index transmision_fecha_estado_idx
      on emisora.transmision (fecha_transmision, estado)
  `.execute(db);
  await sql`
    create index prestamo_mifi_usuario_fecha_idx
      on emisora.prestamo_mifi (usuario_id, fecha_transmision)
  `.execute(db);
  await sql`
    create index lectura_transmisor_registro_idx
      on emisora.lectura_transmisor (registrado_por, fecha)
  `.execute(db);
  await sql`create index obra_fecha_inclusion_idx on emisora.obra (fecha_inclusion)`.execute(db);
  await sql`create index equipo_estado_idx on emisora.hoja_vida_equipo (estado)`.execute(db);
  await sql`
    create index tramite_estado_destino_idx
      on emisora.tramite_externo (estado, destino)
  `.execute(db);
  await sql`
    create index archivo_emisora_tipo_fecha_idx
      on emisora.archivo_emisora (tipo, fecha)
  `.execute(db);

  await sql`
    alter table emisora.programacion_item
      add constraint programacion_item_franja_no_solape
      exclude using gist (
        programacion_diaria_id with =,
        fecha with =,
        int4range(
          extract(epoch from hora_inicio)::integer,
          extract(epoch from hora_fin)::integer,
          '[)'
        ) with &&
      )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table emisora.programacion_item
      drop constraint if exists programacion_item_franja_no_solape
  `.execute(db);

  await sql`drop index if exists emisora.archivo_emisora_tipo_fecha_idx`.execute(db);
  await sql`drop index if exists emisora.tramite_estado_destino_idx`.execute(db);
  await sql`drop index if exists emisora.equipo_estado_idx`.execute(db);
  await sql`drop index if exists emisora.obra_fecha_inclusion_idx`.execute(db);
  await sql`drop index if exists emisora.lectura_transmisor_registro_idx`.execute(db);
  await sql`drop index if exists emisora.prestamo_mifi_usuario_fecha_idx`.execute(db);
  await sql`drop index if exists emisora.transmision_fecha_estado_idx`.execute(db);
  await sql`drop index if exists emisora.incentivo_estado_idx`.execute(db);
  await sql`drop index if exists emisora.audio_sesion_idx`.execute(db);
  await sql`drop index if exists emisora.sesion_grabacion_fecha_estado_idx`.execute(db);
  await sql`drop index if exists emisora.programacion_item_fecha_hora_idx`.execute(db);
  await sql`drop index if exists emisora.programacion_diaria_rejilla_fecha_idx`.execute(db);
  await sql`drop index if exists emisora.rejilla_item_rejilla_dia_idx`.execute(db);
  await sql`drop index if exists emisora.proyecto_realizador_idx`.execute(db);
  await sql`drop index if exists emisora.proyecto_convocatoria_estado_idx`.execute(db);
  await sql`drop index if exists emisora.realizador_usuario_idx`.execute(db);
  await sql`drop index if exists emisora.convocatoria_estado_cierre_idx`.execute(db);
}
