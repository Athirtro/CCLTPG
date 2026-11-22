import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';

import type { Database, ProgramaFormativoTable } from '../../../../database/schema.js';
import type { ProgramaEstado } from '../../domain/academic-states.js';
import type {
  NewProgramaRecord,
  PageInput,
  PageResult,
  ProgramaRecord,
} from '../../application/academic.types.js';
import type { ProgramRepository } from '../../application/ports/program.repository.js';

export class KyselyProgramRepository implements ProgramRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: NewProgramaRecord): Promise<ProgramaRecord> {
    const row = await this.db
      .insertInto('academic.programa_formativo')
      .values({
        id: input.id,
        nombre: input.nombre,
        descripcion: input.descripcion,
        area: input.area,
        cupo_maximo: input.cupoMaximo,
        estado: 'borrador',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapPrograma(row);
  }

  async findById(id: string): Promise<ProgramaRecord | null> {
    const row = await this.db
      .selectFrom('academic.programa_formativo')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapPrograma(row) : null;
  }

  async updateState(id: string, estado: ProgramaEstado): Promise<ProgramaRecord> {
    const row = await this.db
      .updateTable('academic.programa_formativo')
      .set({ estado })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapPrograma(row);
  }

  async list(page: PageInput): Promise<PageResult<ProgramaRecord>> {
    const offset = (page.page - 1) * page.pageSize;
    const [rows, totalRow] = await Promise.all([
      this.db
        .selectFrom('academic.programa_formativo')
        .selectAll()
        .orderBy('creado_en', 'desc')
        .orderBy('id', 'asc')
        .limit(page.pageSize)
        .offset(offset)
        .execute(),
      this.db
        .selectFrom('academic.programa_formativo')
        .select(sql<string>`count(*)::text`.as('total'))
        .executeTakeFirstOrThrow(),
    ]);

    return {
      page: page.page,
      pageSize: page.pageSize,
      total: Number(totalRow.total),
      data: rows.map(mapPrograma),
    };
  }
}

function mapPrograma(row: Selectable<ProgramaFormativoTable>): ProgramaRecord {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    area: row.area,
    cupoMaximo: row.cupo_maximo,
    estado: row.estado,
    creadoEn: row.creado_en,
  };
}
