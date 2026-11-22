import type { Kysely, Selectable } from 'kysely';

import type { ArchivoTable, Database } from '../../../../database/schema.js';
import type {
  FileRecord,
  FileRepository,
  NewFileRecord,
} from '../../application/ports/file.repository.js';

export class KyselyFileRepository implements FileRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: NewFileRecord): Promise<FileRecord> {
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
        estado_escaneo: input.estadoEscaneo,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapFile(row);
  }

  async findById(id: string): Promise<FileRecord | null> {
    const row = await this.db
      .selectFrom('archivo')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapFile(row) : null;
  }

  async findByHash(hashSha256: string): Promise<FileRecord[]> {
    const rows = await this.db
      .selectFrom('archivo')
      .selectAll()
      .where('hash_sha256', '=', hashSha256)
      .orderBy('creado_en', 'desc')
      .execute();
    return rows.map(mapFile);
  }
}

function mapFile(row: Selectable<ArchivoTable>): FileRecord {
  return {
    id: row.id,
    nombreOriginal: row.nombre_original,
    mime: row.mime,
    tamano: row.tamano,
    hashSha256: row.hash_sha256,
    rutaObjeto: row.ruta_objeto,
    subidoPor: row.subido_por,
    estadoEscaneo: row.estado_escaneo,
    creadoEn: row.creado_en,
  };
}
