import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';

import type { Database, EvaluacionCualitativaTable } from '../../../../database/schema.js';
import type {
  EvaluacionConIndicadorRecord,
  EvaluacionListFilter,
  EvaluacionRecord,
  MiEvaluacionRecord,
  NewEvaluacionRecord,
  PageResult,
} from '../../application/academic.types.js';
import type { EvaluationRepository } from '../../application/ports/evaluation.repository.js';

export class KyselyEvaluationRepository implements EvaluationRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: NewEvaluacionRecord): Promise<EvaluacionRecord> {
    const row = await this.db
      .insertInto('academic.evaluacion_cualitativa')
      .values({
        id: input.id,
        matricula_id: input.matriculaId,
        indicador_id: input.indicadorId,
        periodo: input.periodo,
        valor: input.valor,
        observacion: input.observacion,
        evaluado_por: input.evaluadoPor,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapEvaluacion(row);
  }

  async findById(id: string): Promise<EvaluacionRecord | null> {
    const row = await this.db
      .selectFrom('academic.evaluacion_cualitativa')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapEvaluacion(row) : null;
  }

  async findDuplicate(input: {
    matriculaId: string;
    indicadorId: string;
    periodo: string;
  }): Promise<EvaluacionRecord | null> {
    const row = await this.db
      .selectFrom('academic.evaluacion_cualitativa')
      .selectAll()
      .where('matricula_id', '=', input.matriculaId)
      .where('indicador_id', '=', input.indicadorId)
      .where('periodo', '=', input.periodo)
      .executeTakeFirst();
    return row ? mapEvaluacion(row) : null;
  }

  async list(filter: EvaluacionListFilter): Promise<PageResult<EvaluacionConIndicadorRecord>> {
    const offset = (filter.page - 1) * filter.pageSize;
    let query = this.db
      .selectFrom('academic.evaluacion_cualitativa as e')
      .innerJoin('academic.matricula as m', 'm.id', 'e.matricula_id')
      .innerJoin('academic.grupo as g', 'g.id', 'm.grupo_id')
      .innerJoin('academic.indicador_evaluacion as i', 'i.id', 'e.indicador_id');
    let countQuery = this.db
      .selectFrom('academic.evaluacion_cualitativa as e')
      .innerJoin('academic.matricula as m', 'm.id', 'e.matricula_id')
      .innerJoin('academic.grupo as g', 'g.id', 'm.grupo_id');

    if (filter.grupoId) {
      query = query.where('m.grupo_id', '=', filter.grupoId);
      countQuery = countQuery.where('m.grupo_id', '=', filter.grupoId);
    }
    if (filter.educadorId) {
      query = query.where('g.educador_id', '=', filter.educadorId);
      countQuery = countQuery.where('g.educador_id', '=', filter.educadorId);
    }
    if (filter.estudianteUsuarioId) {
      query = query
        .innerJoin('academic.estudiante as est', 'est.id', 'm.estudiante_id')
        .where('est.usuario_id', '=', filter.estudianteUsuarioId);
      countQuery = countQuery
        .innerJoin('academic.estudiante as est', 'est.id', 'm.estudiante_id')
        .where('est.usuario_id', '=', filter.estudianteUsuarioId);
    }

    const [rows, totalRow] = await Promise.all([
      query
        .selectAll('e')
        .select('i.nombre as indicadorNombre')
        .orderBy('e.evaluado_en', 'desc')
        .limit(filter.pageSize)
        .offset(offset)
        .execute(),
      countQuery.select(sql<string>`count(*)::text`.as('total')).executeTakeFirstOrThrow(),
    ]);

    return {
      page: filter.page,
      pageSize: filter.pageSize,
      total: Number(totalRow.total),
      data: rows.map(mapEvaluacionConIndicador),
    };
  }

  async listForStudent(usuarioId: string): Promise<MiEvaluacionRecord[]> {
    const rows = await this.db
      .selectFrom('academic.evaluacion_cualitativa as e')
      .innerJoin('academic.matricula as m', 'm.id', 'e.matricula_id')
      .innerJoin('academic.estudiante as est', 'est.id', 'm.estudiante_id')
      .innerJoin('academic.grupo as g', 'g.id', 'm.grupo_id')
      .innerJoin('academic.programa_formativo as p', 'p.id', 'g.programa_id')
      .innerJoin('academic.indicador_evaluacion as i', 'i.id', 'e.indicador_id')
      .selectAll('e')
      .select([
        'i.nombre as indicadorNombre',
        'g.codigo as grupoCodigo',
        'p.nombre as programaNombre',
      ])
      .where('est.usuario_id', '=', usuarioId)
      .orderBy('e.evaluado_en', 'desc')
      .execute();
    return rows.map(mapMiEvaluacion);
  }

  async update(
    id: string,
    changes: { valor: EvaluacionRecord['valor']; observacion: string | null },
  ): Promise<EvaluacionRecord> {
    const row = await this.db
      .updateTable('academic.evaluacion_cualitativa')
      .set({
        valor: changes.valor,
        observacion: changes.observacion,
        actualizado_en: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapEvaluacion(row);
  }
}

function mapEvaluacion(row: Selectable<EvaluacionCualitativaTable>): EvaluacionRecord {
  return {
    id: row.id,
    matriculaId: row.matricula_id,
    indicadorId: row.indicador_id,
    periodo: row.periodo,
    valor: row.valor,
    observacion: row.observacion,
    evaluadoPor: row.evaluado_por,
    evaluadoEn: row.evaluado_en,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

function mapEvaluacionConIndicador(
  row: Selectable<EvaluacionCualitativaTable> & { indicadorNombre: string },
): EvaluacionConIndicadorRecord {
  return { ...mapEvaluacion(row), indicadorNombre: row.indicadorNombre };
}

function mapMiEvaluacion(
  row: Selectable<EvaluacionCualitativaTable> & {
    indicadorNombre: string;
    grupoCodigo: string;
    programaNombre: string;
  },
): MiEvaluacionRecord {
  return {
    ...mapEvaluacionConIndicador(row),
    grupoCodigo: row.grupoCodigo,
    programaNombre: row.programaNombre,
  };
}
