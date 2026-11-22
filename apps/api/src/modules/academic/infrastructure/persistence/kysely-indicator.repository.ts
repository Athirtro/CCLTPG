import type { Kysely, Selectable } from 'kysely';

import type { Database, IndicadorEvaluacionTable } from '../../../../database/schema.js';
import type { IndicadorRecord } from '../../application/academic.types.js';
import type { IndicatorRepository } from '../../application/ports/indicator.repository.js';

export class KyselyIndicatorRepository implements IndicatorRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: string): Promise<IndicadorRecord | null> {
    const row = await this.db
      .selectFrom('academic.indicador_evaluacion')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapIndicador(row) : null;
  }

  async listByPrograma(programaId: string): Promise<IndicadorRecord[]> {
    const rows = await this.db
      .selectFrom('academic.indicador_evaluacion')
      .selectAll()
      .where((eb) => eb.or([eb('programa_id', 'is', null), eb('programa_id', '=', programaId)]))
      .orderBy('nombre', 'asc')
      .execute();
    return rows.map(mapIndicador);
  }
}

function mapIndicador(row: Selectable<IndicadorEvaluacionTable>): IndicadorRecord {
  return {
    id: row.id,
    programaId: row.programa_id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    escala: row.escala,
    creadoEn: row.creado_en,
  };
}
