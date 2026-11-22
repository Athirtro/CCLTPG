import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';

import type { Database, SesionClaseTable } from '../../../../database/schema.js';
import type { SesionEstado } from '../../domain/academic-states.js';
import type {
  NewSesionRecord,
  PageResult,
  SesionListFilter,
  SesionRecord,
} from '../../application/academic.types.js';
import type { SessionRepository } from '../../application/ports/session.repository.js';

export class KyselySessionRepository implements SessionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: NewSesionRecord): Promise<SesionRecord> {
    const row = await this.db
      .insertInto('academic.sesion_clase')
      .values({
        id: input.id,
        grupo_id: input.grupoId,
        fecha: input.fecha,
        tema: input.tema,
        estado: 'programada',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapSesion(row);
  }

  async findById(id: string): Promise<SesionRecord | null> {
    const row = await this.db
      .selectFrom('academic.sesion_clase')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapSesion(row) : null;
  }

  async lockById(id: string): Promise<SesionRecord | null> {
    const row = await this.db
      .selectFrom('academic.sesion_clase')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    return row ? mapSesion(row) : null;
  }

  async updateState(id: string, estado: SesionEstado): Promise<SesionRecord> {
    const row = await this.db
      .updateTable('academic.sesion_clase')
      .set({ estado, actualizado_en: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapSesion(row);
  }

  async list(filter: SesionListFilter): Promise<PageResult<SesionRecord>> {
    const offset = (filter.page - 1) * filter.pageSize;
    const [rows, totalRow] = await Promise.all([
      this.db
        .selectFrom('academic.sesion_clase')
        .selectAll()
        .where('grupo_id', '=', filter.grupoId)
        .orderBy('fecha', 'desc')
        .orderBy('id', 'asc')
        .limit(filter.pageSize)
        .offset(offset)
        .execute(),
      this.db
        .selectFrom('academic.sesion_clase')
        .select(sql<string>`count(*)::text`.as('total'))
        .where('grupo_id', '=', filter.grupoId)
        .executeTakeFirstOrThrow(),
    ]);

    return {
      page: filter.page,
      pageSize: filter.pageSize,
      total: Number(totalRow.total),
      data: rows.map(mapSesion),
    };
  }
}

function mapSesion(row: Selectable<SesionClaseTable>): SesionRecord {
  return {
    id: row.id,
    grupoId: row.grupo_id,
    fecha: row.fecha,
    tema: row.tema,
    estado: row.estado,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}
