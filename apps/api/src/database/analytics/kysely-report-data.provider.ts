import type { Kysely } from 'kysely';
import { sql } from 'kysely';

import type { Database } from '../schema.js';
import type {
  AnalyticsReportFilter,
  ReportDataPort,
  ReportRow,
} from '../../shared/analytics/report-data.port.js';

/**
 * Consultas de reportes académicos sobre PostgreSQL (C6 — RB1-52).
 *
 * Solo devuelve filas ya filtradas por periodo, programa, grupo y educador. El
 * identificador de estudiante es la matrícula (seudónimo): los reportes no
 * exponen nombres, documentos ni direcciones.
 */
export class KyselyReportDataProvider implements ReportDataPort {
  constructor(private readonly db: Kysely<Database>) {}

  async rowsFor(code: string, filter: AnalyticsReportFilter): Promise<ReportRow[]> {
    const where = this.where(filter);

    switch (code) {
      case 'asistencia': {
        const result = await sql<ReportRow>`
          select g.codigo::text as grupo,
                 s.id::text as sesion,
                 m.id::text as estudiante,
                 a.estado::text as estado
          from academic.asistencia as a
          inner join academic.sesion_clase as s on s.id = a.sesion_id
          inner join academic.matricula as m on m.id = a.matricula_id
          inner join academic.grupo as g on g.id = m.grupo_id
          where s.estado = 'realizada' and ${where}
          order by g.codigo asc, s.fecha asc, m.id asc
        `.execute(this.db);
        return result.rows;
      }
      case 'desempeno': {
        const result = await sql<ReportRow>`
          select g.codigo::text as grupo,
                 i.nombre::text as indicador,
                 m.id::text as estudiante,
                 e.valor::text as valor
          from academic.evaluacion_cualitativa as e
          inner join academic.matricula as m on m.id = e.matricula_id
          inner join academic.grupo as g on g.id = m.grupo_id
          inner join academic.indicador_evaluacion as i on i.id = e.indicador_id
          where ${where}
          order by g.codigo asc, i.nombre asc, m.id asc
        `.execute(this.db);
        return result.rows;
      }
      case 'matricula': {
        const result = await sql<ReportRow>`
          select p.nombre::text as programa,
                 g.codigo::text as grupo,
                 m.estado::text as estado,
                 count(*)::int as total
          from academic.matricula as m
          inner join academic.grupo as g on g.id = m.grupo_id
          inner join academic.programa_formativo as p on p.id = g.programa_id
          where ${where}
          group by p.nombre, g.codigo, m.estado
          order by p.nombre asc, g.codigo asc, m.estado asc
        `.execute(this.db);
        return result.rows;
      }
      case 'desercion': {
        const result = await sql<ReportRow>`
          select g.periodo::text as periodo,
                 g.codigo::text as grupo,
                 (count(*) filter (where m.estado = 'retirada'))::int as retiradas,
                 coalesce(
                   round(
                     100.0 * (count(*) filter (where m.estado = 'retirada')) / nullif(count(*), 0),
                     2
                   ),
                   0
                 )::float8 as porcentaje
          from academic.matricula as m
          inner join academic.grupo as g on g.id = m.grupo_id
          where m.estado in ('activa', 'finalizada', 'retirada') and ${where}
          group by g.periodo, g.codigo
          order by g.periodo asc, g.codigo asc
        `.execute(this.db);
        return result.rows;
      }
      default:
        return [];
    }
  }

  async groupBelongsToEducador(grupoId: string, educadorId: string): Promise<boolean> {
    const result = await sql<{ id: string }>`
      select id from academic.grupo where id = ${grupoId} and educador_id = ${educadorId} limit 1
    `.execute(this.db);
    return result.rows.length > 0;
  }

  private where(filter: AnalyticsReportFilter) {
    const parts = [sql`g.periodo = ${filter.periodo}`];
    if (filter.programaId) {
      parts.push(sql`g.programa_id = ${filter.programaId}`);
    }
    if (filter.grupoId) {
      parts.push(sql`g.id = ${filter.grupoId}`);
    }
    if (filter.educadorId) {
      parts.push(sql`g.educador_id = ${filter.educadorId}`);
    }
    return sql.join(parts, sql` and `);
  }
}
