import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';
import { v7 as uuidv7 } from 'uuid';

import type { Database, GrupoTable, HorarioGrupoTable } from '../../../../database/schema.js';
import {
  CAPACITY_MATRICULA_STATES,
  VIGENT_MATRICULA_STATES,
  type GrupoEstado,
} from '../../domain/academic-states.js';
import type {
  GrupoRecord,
  HorarioConGrupoRecord,
  HorarioInput,
  HorarioRecord,
  NewGrupoRecord,
  PageResult,
} from '../../application/academic.types.js';
import type {
  GroupRepository,
  GroupListFilter,
  ScheduleOverlapInput,
} from '../../application/ports/group.repository.js';

export class KyselyGroupRepository implements GroupRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: NewGrupoRecord): Promise<GrupoRecord> {
    const row = await this.db
      .insertInto('academic.grupo')
      .values({
        id: input.id,
        programa_id: input.programaId,
        codigo: input.codigo,
        educador_id: input.educadorId,
        salon: input.salon,
        periodo: input.periodo,
        cupo_maximo: input.cupoMaximo,
        estado: 'abierto',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapGrupo(row);
  }

  async findById(id: string): Promise<GrupoRecord | null> {
    const row = await this.db
      .selectFrom('academic.grupo')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapGrupo(row) : null;
  }

  async updateState(id: string, estado: GrupoEstado): Promise<GrupoRecord> {
    const row = await this.db
      .updateTable('academic.grupo')
      .set({ estado })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapGrupo(row);
  }

  async list(filter: GroupListFilter): Promise<PageResult<GrupoRecord>> {
    const offset = (filter.page - 1) * filter.pageSize;

    const base = this.db.selectFrom('academic.grupo');
    const filtered =
      filter.educadorId === null ? base : base.where('educador_id', '=', filter.educadorId);

    const [rows, totalRow] = await Promise.all([
      filtered
        .selectAll()
        .orderBy('creado_en', 'desc')
        .orderBy('id', 'asc')
        .limit(filter.pageSize)
        .offset(offset)
        .execute(),
      filtered.select(sql<string>`count(*)::text`.as('total')).executeTakeFirstOrThrow(),
    ]);

    return {
      page: filter.page,
      pageSize: filter.pageSize,
      total: Number(totalRow.total),
      data: rows.map(mapGrupo),
    };
  }

  async findSchedule(grupoId: string): Promise<HorarioRecord[]> {
    const rows = await this.db
      .selectFrom('academic.horario_grupo')
      .selectAll()
      .where('grupo_id', '=', grupoId)
      .orderBy('dia_semana', 'asc')
      .orderBy('hora_inicio', 'asc')
      .execute();
    return rows.map(mapHorario);
  }

  async replaceSchedule(grupoId: string, slots: readonly HorarioInput[]): Promise<HorarioRecord[]> {
    await this.db.deleteFrom('academic.horario_grupo').where('grupo_id', '=', grupoId).execute();

    if (slots.length === 0) {
      return [];
    }

    const rows = await this.db
      .insertInto('academic.horario_grupo')
      .values(
        slots.map((slot) => ({
          id: uuidv7(),
          grupo_id: grupoId,
          dia_semana: slot.diaSemana,
          hora_inicio: slot.horaInicio,
          hora_fin: slot.horaFin,
        })),
      )
      .returningAll()
      .execute();

    return rows.map(mapHorario);
  }

  async lockById(id: string): Promise<GrupoRecord | null> {
    const row = await this.db
      .selectFrom('academic.grupo')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    return row ? mapGrupo(row) : null;
  }

  async hasScheduleOverlap(input: ScheduleOverlapInput): Promise<boolean> {
    if (input.slots.length === 0) {
      return false;
    }

    const rows = await this.db
      .selectFrom('academic.horario_grupo as hg')
      .innerJoin('academic.grupo as g', 'g.id', 'hg.grupo_id')
      .select('hg.id')
      .where('g.periodo', '=', input.periodo)
      .where('g.id', '!=', input.grupoId)
      .where((eb) =>
        eb.or([
          eb('g.educador_id', '=', input.educadorId),
          ...(input.salon === null ? [] : [eb('g.salon', '=', input.salon)]),
        ]),
      )
      .where((eb) =>
        eb.or(
          input.slots.map((slot) =>
            eb.and([
              eb('hg.dia_semana', '=', slot.diaSemana),
              eb('hg.hora_inicio', '<', slot.horaFin),
              eb('hg.hora_fin', '>', slot.horaInicio),
            ]),
          ),
        ),
      )
      .limit(1)
      .execute();

    return rows.length > 0;
  }

  async acquireScheduleLocks(keys: readonly string[]): Promise<void> {
    for (const key of keys) {
      await sql`select pg_advisory_xact_lock(hashtext(${key}))`.execute(this.db);
    }
  }

  async listEnrolledUsuarioIds(grupoId: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('academic.matricula as m')
      .innerJoin('academic.estudiante as e', 'e.id', 'm.estudiante_id')
      .select('e.usuario_id as usuarioId')
      .where('m.grupo_id', '=', grupoId)
      .where('m.estado', 'in', [...CAPACITY_MATRICULA_STATES])
      .where('e.usuario_id', 'is not', null)
      .execute();

    return rows
      .map((row) => row.usuarioId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
  }

  async isStudentEnrolled(grupoId: string, usuarioId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('academic.matricula as m')
      .innerJoin('academic.estudiante as e', 'e.id', 'm.estudiante_id')
      .select('m.id')
      .where('m.grupo_id', '=', grupoId)
      .where('e.usuario_id', '=', usuarioId)
      .where('m.estado', 'in', [...VIGENT_MATRICULA_STATES])
      .limit(1)
      .executeTakeFirst();
    return Boolean(row);
  }

  async findScheduleForStudent(usuarioId: string): Promise<HorarioConGrupoRecord[]> {
    const rows = await this.db
      .selectFrom('academic.matricula as m')
      .innerJoin('academic.estudiante as e', 'e.id', 'm.estudiante_id')
      .innerJoin('academic.grupo as g', 'g.id', 'm.grupo_id')
      .innerJoin('academic.programa_formativo as p', 'p.id', 'g.programa_id')
      .innerJoin('academic.horario_grupo as hg', 'hg.grupo_id', 'g.id')
      .select([
        'hg.id as id',
        'hg.grupo_id as grupoId',
        'hg.dia_semana as diaSemana',
        'hg.hora_inicio as horaInicio',
        'hg.hora_fin as horaFin',
        'g.codigo as grupoCodigo',
        'g.salon as salon',
        'g.periodo as periodo',
        'p.nombre as programaNombre',
      ])
      .where('e.usuario_id', '=', usuarioId)
      .where('m.estado', 'in', [...VIGENT_MATRICULA_STATES])
      .orderBy('hg.dia_semana', 'asc')
      .orderBy('hg.hora_inicio', 'asc')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      grupoId: row.grupoId,
      diaSemana: Number(row.diaSemana),
      horaInicio: row.horaInicio,
      horaFin: row.horaFin,
      grupoCodigo: row.grupoCodigo,
      programaNombre: row.programaNombre,
      salon: row.salon,
      periodo: row.periodo,
    }));
  }
}

function mapGrupo(row: Selectable<GrupoTable>): GrupoRecord {
  return {
    id: row.id,
    programaId: row.programa_id,
    codigo: row.codigo,
    educadorId: row.educador_id,
    salon: row.salon,
    periodo: row.periodo,
    cupoMaximo: row.cupo_maximo,
    estado: row.estado,
    creadoEn: row.creado_en,
  };
}

function mapHorario(row: Selectable<HorarioGrupoTable>): HorarioRecord {
  return {
    id: row.id,
    grupoId: row.grupo_id,
    diaSemana: Number(row.dia_semana),
    horaInicio: row.hora_inicio,
    horaFin: row.hora_fin,
  };
}
