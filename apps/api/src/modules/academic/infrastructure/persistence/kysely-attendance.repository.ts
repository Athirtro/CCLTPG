import type { Kysely, Selectable } from 'kysely';

import type { Database, AsistenciaTable } from '../../../../database/schema.js';
import type { AsistenciaRecord, NewAsistenciaRecord } from '../../application/academic.types.js';
import type { AttendanceRepository } from '../../application/ports/attendance.repository.js';

export class KyselyAttendanceRepository implements AttendanceRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async listBySession(sesionId: string): Promise<AsistenciaRecord[]> {
    const rows = await this.db
      .selectFrom('academic.asistencia')
      .selectAll()
      .where('sesion_id', '=', sesionId)
      .orderBy('id', 'asc')
      .execute();
    return rows.map(mapAsistencia);
  }

  async listByMatricula(matriculaId: string): Promise<AsistenciaRecord[]> {
    const rows = await this.db
      .selectFrom('academic.asistencia')
      .selectAll()
      .where('matricula_id', '=', matriculaId)
      .orderBy('registrado_en', 'desc')
      .execute();
    return rows.map(mapAsistencia);
  }

  async findBySessionAndMatricula(
    sesionId: string,
    matriculaId: string,
  ): Promise<AsistenciaRecord | null> {
    const row = await this.db
      .selectFrom('academic.asistencia')
      .selectAll()
      .where('sesion_id', '=', sesionId)
      .where('matricula_id', '=', matriculaId)
      .executeTakeFirst();
    return row ? mapAsistencia(row) : null;
  }

  async replace(
    sesionId: string,
    rows: readonly NewAsistenciaRecord[],
  ): Promise<AsistenciaRecord[]> {
    await this.db.deleteFrom('academic.asistencia').where('sesion_id', '=', sesionId).execute();
    if (rows.length === 0) {
      return [];
    }
    const inserted = await this.db
      .insertInto('academic.asistencia')
      .values(
        rows.map((row) => ({
          id: row.id,
          sesion_id: sesionId,
          matricula_id: row.matriculaId,
          estado: row.estado,
          registrado_por: row.registradoPor,
        })),
      )
      .returningAll()
      .execute();
    return inserted.map(mapAsistencia);
  }
}

function mapAsistencia(row: Selectable<AsistenciaTable>): AsistenciaRecord {
  return {
    id: row.id,
    sesionId: row.sesion_id,
    matriculaId: row.matricula_id,
    estado: row.estado,
    registradoPor: row.registrado_por,
    registradoEn: row.registrado_en,
  };
}
