import type { Kysely } from 'kysely';

import type { Database } from '../../../../database/schema.js';
import type {
  ExportFileRecord,
  ExportFileRepository,
  NewExportFileRecord,
} from '../../application/ports/export-file.repository.js';

export class KyselyExportFileRepository implements ExportFileRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: NewExportFileRecord): Promise<ExportFileRecord> {
    const row = await this.db
      .insertInto('archivo')
      .values({
        id: input.id,
        nombre_original: input.nombreOriginal,
        mime: input.mime,
        tamano: input.tamano,
        hash_sha256: input.hashSha256,
        ruta_objeto: input.rutaObjeto,
        subido_por: input.subidoPor,
        estado_escaneo: 'limpio',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      nombreOriginal: row.nombre_original,
      mime: row.mime,
      tamano: row.tamano,
      hashSha256: row.hash_sha256,
      rutaObjeto: row.ruta_objeto,
      creadoEn: row.creado_en,
    };
  }
}
