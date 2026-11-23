import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';

import type { Database, EstudianteTable } from '../../../../database/schema.js';
import type {
  EstudianteRecord,
  NewEstudianteRecord,
  PageInput,
  PageResult,
  UpdateEstudianteRecord,
} from '../../application/academic.types.js';
import type { StudentRepository } from '../../application/ports/student.repository.js';

export class KyselyStudentRepository implements StudentRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: NewEstudianteRecord): Promise<EstudianteRecord> {
    const row = await this.db
      .insertInto('academic.estudiante')
      .values({
        id: input.id,
        usuario_id: input.usuarioId,
        tipo_documento: input.tipoDocumento,
        numero_documento: input.numeroDocumentoCifrado,
        numero_documento_hash: input.numeroDocumentoHash,
        nombres: input.nombres,
        apellidos: input.apellidos,
        fecha_nacimiento: input.fechaNacimiento,
        municipio: input.municipio,
        barrio: input.barrio,
        direccion: input.direccionCifrada,
        telefono: input.telefonoCifrado,
        acudiente: input.acudiente as never,
        consentimiento_datos: input.consentimientoDatos as never,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapEstudiante(row);
  }

  async findById(id: string): Promise<EstudianteRecord | null> {
    const row = await this.db
      .selectFrom('academic.estudiante')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapEstudiante(row) : null;
  }

  async findByUsuarioId(usuarioId: string): Promise<EstudianteRecord | null> {
    const row = await this.db
      .selectFrom('academic.estudiante')
      .selectAll()
      .where('usuario_id', '=', usuarioId)
      .executeTakeFirst();
    return row ? mapEstudiante(row) : null;
  }

  async findByDocumentHash(hash: string): Promise<EstudianteRecord | null> {
    const row = await this.db
      .selectFrom('academic.estudiante')
      .selectAll()
      .where('numero_documento_hash', '=', hash)
      .executeTakeFirst();
    return row ? mapEstudiante(row) : null;
  }

  async findUsuarioIdByMatricula(matriculaId: string): Promise<string | null> {
    const row = await this.db
      .selectFrom('academic.matricula as m')
      .innerJoin('academic.estudiante as e', 'e.id', 'm.estudiante_id')
      .select('e.usuario_id as usuarioId')
      .where('m.id', '=', matriculaId)
      .executeTakeFirst();
    return row?.usuarioId ?? null;
  }

  async update(id: string, input: UpdateEstudianteRecord): Promise<EstudianteRecord> {
    const row = await this.db
      .updateTable('academic.estudiante')
      .set({
        usuario_id: input.usuarioId,
        tipo_documento: input.tipoDocumento,
        numero_documento: input.numeroDocumentoCifrado,
        numero_documento_hash: input.numeroDocumentoHash,
        nombres: input.nombres,
        apellidos: input.apellidos,
        fecha_nacimiento: input.fechaNacimiento,
        municipio: input.municipio,
        barrio: input.barrio,
        direccion: input.direccionCifrada,
        telefono: input.telefonoCifrado,
        acudiente: input.acudiente as never,
        consentimiento_datos: input.consentimientoDatos as never,
        actualizado_en: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapEstudiante(row);
  }

  async list(page: PageInput): Promise<PageResult<EstudianteRecord>> {
    const offset = (page.page - 1) * page.pageSize;
    const [rows, totalRow] = await Promise.all([
      this.db
        .selectFrom('academic.estudiante')
        .selectAll()
        .orderBy('apellidos', 'asc')
        .orderBy('nombres', 'asc')
        .orderBy('id', 'asc')
        .limit(page.pageSize)
        .offset(offset)
        .execute(),
      this.db
        .selectFrom('academic.estudiante')
        .select(sql<string>`count(*)::text`.as('total'))
        .executeTakeFirstOrThrow(),
    ]);

    return {
      page: page.page,
      pageSize: page.pageSize,
      total: Number(totalRow.total),
      data: rows.map(mapEstudiante),
    };
  }
}

function mapEstudiante(row: Selectable<EstudianteTable>): EstudianteRecord {
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    tipoDocumento: row.tipo_documento,
    numeroDocumentoCifrado: row.numero_documento,
    numeroDocumentoHash: row.numero_documento_hash,
    nombres: row.nombres,
    apellidos: row.apellidos,
    fechaNacimiento: row.fecha_nacimiento,
    municipio: row.municipio,
    barrio: row.barrio,
    direccionCifrada: row.direccion,
    telefonoCifrado: row.telefono,
    acudiente: row.acudiente,
    consentimientoDatos: row.consentimiento_datos,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}
