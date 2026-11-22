import { sql, type Kysely } from 'kysely';

/**
 * Índices y restricciones académicas (C4 — RB1-28).
 *
 * D63: la unicidad de matrícula es **parcial** sobre los estados vigentes
 * (`preinscrita`, `confirmada`, `activa`). Así se conserva el historial y se
 * permite volver a matricular tras una cancelación o retiro.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create unique index matricula_vigente_unique
      on academic.matricula (estudiante_id, grupo_id, periodo)
      where estado in ('preinscrita', 'confirmada', 'activa')
  `.execute(db);

  await sql`create index matricula_grupo_estado_idx on academic.matricula (grupo_id, estado)`.execute(
    db,
  );
  await sql`create index matricula_estudiante_periodo_idx on academic.matricula (estudiante_id, periodo)`.execute(
    db,
  );
  await sql`create index horario_grupo_grupo_dia_idx on academic.horario_grupo (grupo_id, dia_semana)`.execute(
    db,
  );
  await sql`create index grupo_educador_periodo_idx on academic.grupo (educador_id, periodo)`.execute(
    db,
  );
  await sql`create index grupo_programa_idx on academic.grupo (programa_id)`.execute(db);
  await sql`create index programa_formativo_estado_idx on academic.programa_formativo (estado)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop index if exists academic.programa_formativo_estado_idx`.execute(db);
  await sql`drop index if exists academic.grupo_programa_idx`.execute(db);
  await sql`drop index if exists academic.grupo_educador_periodo_idx`.execute(db);
  await sql`drop index if exists academic.horario_grupo_grupo_dia_idx`.execute(db);
  await sql`drop index if exists academic.matricula_estudiante_periodo_idx`.execute(db);
  await sql`drop index if exists academic.matricula_grupo_estado_idx`.execute(db);
  await sql`drop index if exists academic.matricula_vigente_unique`.execute(db);
}
