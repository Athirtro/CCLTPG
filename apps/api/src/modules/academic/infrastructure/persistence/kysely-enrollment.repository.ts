import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';

import type { Database, MatriculaTable } from '../../../../database/schema.js';
import {
  CAPACITY_MATRICULA_STATES,
  VIGENT_MATRICULA_STATES,
  type MatriculaEstado,
} from '../../domain/academic-states.js';
import type {
  MatriculaListRecord,
  MatriculaRecord,
  NewMatriculaRecord,
  PageInput,
  PageResult,
} from '../../application/academic.types.js';
import type { EnrollmentRepository } from '../../application/ports/enrollment.repository.js';

export class KyselyEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: NewMatriculaRecord): Promise<MatriculaRecord> {
    const row = await this.db
      .insertInto('academic.matricula')
      .values({
        id: input.id,
        estudiante_id: input.estudianteId,
        grupo_id: input.grupoId,
        estado: 'preinscrita',
        fecha_matricula: input.fechaMatricula,
        periodo: input.periodo,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapMatricula(row);
  }

  async findById(id: string): Promise<MatriculaRecord | null> {
    const row = await this.db
      .selectFrom('academic.matricula')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapMatricula(row) : null;
  }

  async findVigente(
    estudianteId: string,
    grupoId: string,
    periodo: string,
  ): Promise<MatriculaRecord | null> {
    const row = await this.db
      .selectFrom('academic.matricula')
      .selectAll()
      .where('estudiante_id', '=', estudianteId)
      .where('grupo_id', '=', grupoId)
      .where('periodo', '=', periodo)
      .where('estado', 'in', [...VIGENT_MATRICULA_STATES])
      .executeTakeFirst();
    return row ? mapMatricula(row) : null;
  }

  async updateState(id: string, estado: MatriculaEstado): Promise<MatriculaRecord> {
    const row = await this.db
      .updateTable('academic.matricula')
      .set({ estado, actualizado_en: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapMatricula(row);
  }

  async countCapacity(grupoId: string): Promise<number> {
    const row = await this.db
      .selectFrom('academic.matricula')
      .select(sql<string>`count(*)::text`.as('total'))
      .where('grupo_id', '=', grupoId)
      .where('estado', 'in', [...CAPACITY_MATRICULA_STATES])
      .executeTakeFirstOrThrow();
    return Number(row.total);
  }

  async listByEstudiante(
    estudianteId: string,
    page: PageInput,
  ): Promise<PageResult<MatriculaListRecord>> {
    const offset = (page.page - 1) * page.pageSize;

    const [rows, totalRow] = await Promise.all([
      this.baseListQuery()
        .where('m.estudiante_id', '=', estudianteId)
        .orderBy('m.fecha_matricula', 'desc')
        .orderBy('m.id', 'asc')
        .limit(page.pageSize)
        .offset(offset)
        .execute(),
      this.db
        .selectFrom('academic.matricula as m')
        .select(sql<string>`count(*)::text`.as('total'))
        .where('m.estudiante_id', '=', estudianteId)
        .executeTakeFirstOrThrow(),
    ]);

    return {
      page: page.page,
      pageSize: page.pageSize,
      total: Number(totalRow.total),
      data: rows.map(mapMatriculaList),
    };
  }

  async listForScope(
    educadorId: string | null,
    page: PageInput,
  ): Promise<PageResult<MatriculaListRecord>> {
    const offset = (page.page - 1) * page.pageSize;

    const scoped = this.baseListQuery();
    const filtered = educadorId === null ? scoped : scoped.where('g.educador_id', '=', educadorId);

    const countBase = this.db
      .selectFrom('academic.matricula as m')
      .innerJoin('academic.grupo as g', 'g.id', 'm.grupo_id')
      .select(sql<string>`count(*)::text`.as('total'));
    const countFiltered =
      educadorId === null ? countBase : countBase.where('g.educador_id', '=', educadorId);

    const [rows, totalRow] = await Promise.all([
      filtered
        .orderBy('m.fecha_matricula', 'desc')
        .orderBy('m.id', 'asc')
        .limit(page.pageSize)
        .offset(offset)
        .execute(),
      countFiltered.executeTakeFirstOrThrow(),
    ]);

    return {
      page: page.page,
      pageSize: page.pageSize,
      total: Number(totalRow.total),
      data: rows.map(mapMatriculaList),
    };
  }

  private baseListQuery() {
    return this.db
      .selectFrom('academic.matricula as m')
      .innerJoin('academic.estudiante as e', 'e.id', 'm.estudiante_id')
      .innerJoin('academic.grupo as g', 'g.id', 'm.grupo_id')
      .innerJoin('academic.programa_formativo as p', 'p.id', 'g.programa_id')
      .select([
        'm.id as id',
        'm.estudiante_id as estudianteId',
        'm.grupo_id as grupoId',
        'm.estado as estado',
        'm.fecha_matricula as fechaMatricula',
        'm.periodo as periodo',
        'm.creado_en as creadoEn',
        'm.actualizado_en as actualizadoEn',
        'e.nombres as estudianteNombres',
        'e.apellidos as estudianteApellidos',
        'g.codigo as grupoCodigo',
        'g.programa_id as programaId',
        'p.nombre as programaNombre',
      ]);
  }
}

function mapMatricula(row: Selectable<MatriculaTable>): MatriculaRecord {
  return {
    id: row.id,
    estudianteId: row.estudiante_id,
    grupoId: row.grupo_id,
    estado: row.estado,
    fechaMatricula: row.fecha_matricula,
    periodo: row.periodo,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

interface MatriculaListRow {
  id: string;
  estudianteId: string;
  grupoId: string;
  estado: MatriculaEstado;
  fechaMatricula: Date;
  periodo: string;
  creadoEn: Date;
  actualizadoEn: Date;
  estudianteNombres: string;
  estudianteApellidos: string;
  grupoCodigo: string;
  programaId: string;
  programaNombre: string;
}

function mapMatriculaList(row: MatriculaListRow): MatriculaListRecord {
  return {
    id: row.id,
    estudianteId: row.estudianteId,
    grupoId: row.grupoId,
    estado: row.estado,
    fechaMatricula: row.fechaMatricula,
    periodo: row.periodo,
    creadoEn: row.creadoEn,
    actualizadoEn: row.actualizadoEn,
    estudianteNombres: row.estudianteNombres,
    estudianteApellidos: row.estudianteApellidos,
    grupoCodigo: row.grupoCodigo,
    programaId: row.programaId,
    programaNombre: row.programaNombre,
  };
}
