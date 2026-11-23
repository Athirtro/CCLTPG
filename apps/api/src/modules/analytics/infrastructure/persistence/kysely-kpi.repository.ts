import type { Kysely } from 'kysely';
import { sql } from 'kysely';

import type { Database } from '../../../../database/schema.js';
import type {
  AttendanceTotals,
  AnalyticsFilter,
  DropoutTotals,
  EvaluationTotals,
  MunicipioCount,
  ProgramTotals,
} from '../../application/analytics.types.js';
import type { KpiRepository } from '../../application/ports/kpi.repository.js';

/**
 * Agregados de KPIs sobre PostgreSQL (C6 — RB1-53…RB1-55).
 *
 * Todas las consultas llevan el ámbito en `WHERE`; nunca devuelven registros
 * individuales. El periodo se toma de la tabla de matrícula/evaluación, salvo
 * en programas y grupos, donde vive en `academic.grupo`.
 */
export class KyselyKpiRepository implements KpiRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async countEnrollments(filter: AnalyticsFilter): Promise<number> {
    const result = await sql<{ total: number }>`
      select count(*)::int as total
      from academic.matricula as m
      inner join academic.grupo as g on g.id = m.grupo_id
      where m.estado in ('preinscrita', 'confirmada', 'activa')
        and ${this.where(MATRICULA_COLUMNS, filter)}
    `.execute(this.db);
    return result.rows[0]?.total ?? 0;
  }

  async attendanceTotals(filter: AnalyticsFilter): Promise<AttendanceTotals> {
    const result = await sql<AttendanceTotals>`
      select
        (count(*) filter (where a.estado = 'presente'))::int as presentes,
        (count(*) filter (where a.estado = 'tarde'))::int as tardes,
        count(*)::int as total
      from academic.asistencia as a
      inner join academic.sesion_clase as s on s.id = a.sesion_id
      inner join academic.matricula as m on m.id = a.matricula_id
      inner join academic.grupo as g on g.id = m.grupo_id
      where s.estado = 'realizada' and ${this.where(MATRICULA_COLUMNS, filter)}
    `.execute(this.db);
    return result.rows[0] ?? { presentes: 0, tardes: 0, total: 0 };
  }

  async evaluationTotals(filter: AnalyticsFilter): Promise<EvaluationTotals> {
    const result = await sql<{ valor: string; total: number }>`
      select e.valor::text as valor, count(*)::int as total
      from academic.evaluacion_cualitativa as e
      inner join academic.matricula as m on m.id = e.matricula_id
      inner join academic.grupo as g on g.id = m.grupo_id
      where ${this.where(EVALUACION_COLUMNS, filter)}
      group by e.valor
    `.execute(this.db);

    const totals: EvaluationTotals = {
      excelente: 0,
      bueno: 0,
      regular: 0,
      deficiente: 0,
    };
    for (const row of result.rows) {
      if (row.valor in totals) {
        totals[row.valor as keyof EvaluationTotals] = row.total;
      }
    }
    return totals;
  }

  async programTotals(filter: AnalyticsFilter): Promise<ProgramTotals> {
    const result = await sql<ProgramTotals>`
      select
        (
          select count(distinct p.id)::int
          from academic.programa_formativo as p
          inner join academic.grupo as g2 on g2.programa_id = p.id
          where p.estado = 'publicado' and ${this.where(grupoColumns('g2'), filter)}
        ) as programas,
        (
          select count(*)::int
          from academic.grupo as g3
          where g3.estado = 'abierto' and ${this.where(grupoColumns('g3'), filter)}
        ) as grupos
    `.execute(this.db);
    return result.rows[0] ?? { programas: 0, grupos: 0 };
  }

  async dropoutTotals(filter: AnalyticsFilter): Promise<DropoutTotals> {
    const result = await sql<DropoutTotals>`
      select
        (count(*) filter (where m.estado = 'retirada'))::int as retiradas,
        count(*)::int as base
      from academic.matricula as m
      inner join academic.grupo as g on g.id = m.grupo_id
      where m.estado in ('activa', 'finalizada', 'retirada')
        and ${this.where(MATRICULA_COLUMNS, filter)}
    `.execute(this.db);
    return result.rows[0] ?? { retiradas: 0, base: 0 };
  }

  async countByMunicipio(filter: AnalyticsFilter): Promise<MunicipioCount[]> {
    const result = await sql<MunicipioCount>`
      select coalesce(e.municipio, 'Sin municipio')::text as municipio,
             count(distinct e.id)::int as total
      from academic.estudiante as e
      inner join academic.matricula as m on m.estudiante_id = e.id
      inner join academic.grupo as g on g.id = m.grupo_id
      where m.estado in ('preinscrita', 'confirmada', 'activa')
        and ${this.where(MATRICULA_COLUMNS, filter)}
      group by coalesce(e.municipio, 'Sin municipio')
      order by total desc, municipio asc
    `.execute(this.db);
    return result.rows;
  }

  async groupBelongsToEducador(grupoId: string, educadorId: string): Promise<boolean> {
    const result = await sql<{ id: string }>`
      select id from academic.grupo where id = ${grupoId} and educador_id = ${educadorId} limit 1
    `.execute(this.db);
    return result.rows.length > 0;
  }

  private where(columns: KpiColumns, filter: AnalyticsFilter) {
    const parts = [sql`${sql.ref(columns.periodo)} = ${filter.periodo}`];
    if (filter.programaId) {
      parts.push(sql`${sql.ref(columns.programa)} = ${filter.programaId}`);
    }
    if (filter.grupoId) {
      parts.push(sql`${sql.ref(columns.grupo)} = ${filter.grupoId}`);
    }
    if (filter.educadorId) {
      parts.push(sql`${sql.ref(columns.educador)} = ${filter.educadorId}`);
    }
    return sql.join(parts, sql` and `);
  }
}

interface KpiColumns {
  periodo: string;
  programa: string;
  grupo: string;
  educador: string;
}

const MATRICULA_COLUMNS: KpiColumns = {
  periodo: 'm.periodo',
  programa: 'g.programa_id',
  grupo: 'm.grupo_id',
  educador: 'g.educador_id',
};

const EVALUACION_COLUMNS: KpiColumns = {
  periodo: 'e.periodo',
  programa: 'g.programa_id',
  grupo: 'm.grupo_id',
  educador: 'g.educador_id',
};

function grupoColumns(alias: string): KpiColumns {
  return {
    periodo: `${alias}.periodo`,
    programa: `${alias}.programa_id`,
    grupo: `${alias}.id`,
    educador: `${alias}.educador_id`,
  };
}
