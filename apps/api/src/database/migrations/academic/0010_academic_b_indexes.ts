import { sql, type Kysely } from 'kysely';

/**
 * Restricciones e índices de Académico B (C5 — RB1-37, D70).
 *
 * - Asistencia única por sesión y matrícula (diseño §7.3, INC-012).
 * - Evaluación única por matrícula, indicador y periodo (INC-012).
 * - Escala de indicadores cerrada a los cuatro valores ratificados en D73.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table academic.indicador_evaluacion
      add constraint indicador_escala_check
      check (escala = 'excelente,bueno,regular,deficiente')
  `.execute(db);

  await sql`
    alter table academic.sesion_clase
      add constraint sesion_tema_check check (tema is null or length(trim(tema)) > 0)
  `.execute(db);

  await sql`
    alter table academic.evaluacion_cualitativa
      add constraint evaluacion_periodo_check check (periodo ~ '^[0-9]{4}-[0-9]+$'),
      add constraint evaluacion_observacion_check
        check (observacion is null or length(trim(observacion)) > 0)
  `.execute(db);

  await sql`
    create unique index asistencia_sesion_matricula_key
      on academic.asistencia (sesion_id, matricula_id)
  `.execute(db);

  await sql`
    create unique index evaluacion_cualitativa_unique
      on academic.evaluacion_cualitativa (matricula_id, indicador_id, periodo)
  `.execute(db);

  await sql`create index asistencia_matricula_idx on academic.asistencia (matricula_id)`.execute(
    db,
  );
  await sql`create index sesion_clase_grupo_fecha_idx on academic.sesion_clase (grupo_id, fecha)`.execute(
    db,
  );
  await sql`create index sesion_clase_estado_idx on academic.sesion_clase (estado)`.execute(db);
  await sql`create index evaluacion_cualitativa_matricula_idx on academic.evaluacion_cualitativa (matricula_id)`.execute(
    db,
  );
  await sql`create index indicador_evaluacion_programa_idx on academic.indicador_evaluacion (programa_id)`.execute(
    db,
  );

  // D73: catálogo global sembrado por migración; sin CRUD en v1.0.
  await sql`
    insert into academic.indicador_evaluacion (id, programa_id, nombre, descripcion, escala)
    values
      ('00000000-0000-4000-8000-000000000001', null, 'Participación',
       'Participación activa del estudiante en la sesión.', 'excelente,bueno,regular,deficiente'),
      ('00000000-0000-4000-8000-000000000002', null, 'Comprensión',
       'Comprensión de los contenidos del programa.', 'excelente,bueno,regular,deficiente'),
      ('00000000-0000-4000-8000-000000000003', null, 'Evolución',
       'Evolución cualitativa durante el periodo.', 'excelente,bueno,regular,deficiente'),
      ('00000000-0000-4000-8000-000000000004', null, 'Actitud',
       'Actitud y compromiso con el grupo.', 'excelente,bueno,regular,deficiente')
    on conflict (id) do nothing
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop index if exists academic.indicador_evaluacion_programa_idx`.execute(db);
  await sql`drop index if exists academic.evaluacion_cualitativa_matricula_idx`.execute(db);
  await sql`drop index if exists academic.sesion_clase_estado_idx`.execute(db);
  await sql`drop index if exists academic.sesion_clase_grupo_fecha_idx`.execute(db);
  await sql`drop index if exists academic.asistencia_matricula_idx`.execute(db);
  await sql`drop index if exists academic.evaluacion_cualitativa_unique`.execute(db);
  await sql`drop index if exists academic.asistencia_sesion_matricula_key`.execute(db);

  await sql`
    alter table academic.evaluacion_cualitativa
      drop constraint if exists evaluacion_observacion_check,
      drop constraint if exists evaluacion_periodo_check
  `.execute(db);
  await sql`
    alter table academic.sesion_clase drop constraint if exists sesion_tema_check
  `.execute(db);
  await sql`
    alter table academic.indicador_evaluacion drop constraint if exists indicador_escala_check
  `.execute(db);
}
