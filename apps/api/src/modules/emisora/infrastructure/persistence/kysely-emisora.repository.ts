import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { v7 as uuidv7 } from 'uuid';

import type { Database } from '../../../../database/schema.js';
import type { IncentivoEstado } from '../../domain/emisora-states.js';
import { EmisoraError } from '../../application/emisora-error.js';
import type {
  AsistenciaRecord,
  AudioRecord,
  ComiteRecord,
  ConvocatoriaRecord,
  GrabacionRecord,
  IncentivoRecord,
  InformeRecord,
  ProgramacionItemRecord,
  ProgramacionRecord,
  ProyectoRecord,
  RealizadorRecord,
  RejillaItemRecord,
  RejillaRecord,
} from '../../application/emisora.types.js';
import {
  type EmisoraRepository,
  type NewAsistencia,
  type NewAudio,
  type NewComite,
  type NewConvocatoria,
  type NewGrabacion,
  type NewInforme,
  type NewProgramacion,
  type NewProyecto,
  type NewRealizador,
} from '../../application/ports/emisora.repository.js';

/** Fecha de calendario enlazada como `date`, sin desplazamiento de zona. */
const dateParam = (valor: string) => sql<Date>`${valor}::date`;

/** node-postgres puede devolver `date` como `Date` local o como texto. */
function fechaText(valor: Date | string): string {
  if (typeof valor === 'string') {
    return valor.slice(0, 10);
  }
  const mes = String(valor.getMonth() + 1).padStart(2, '0');
  const dia = String(valor.getDate()).padStart(2, '0');
  return `${valor.getFullYear()}-${mes}-${dia}`;
}

function textoArray(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.map((entrada) => String(entrada)) : [];
}

/** PostgreSQL devuelve `time` como `HH:MM:SS`; el contrato usa `HH:MM`. */
function horaText(valor: string): string {
  return valor.slice(0, 5);
}

function esSolape(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23P01'
  );
}

export class KyselyEmisoraRepository implements EmisoraRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async createConvocatoria(input: NewConvocatoria): Promise<ConvocatoriaRecord> {
    const row = await this.db
      .insertInto('emisora.convocatoria')
      .values({
        id: input.id,
        anio: input.anio,
        fecha_apertura: dateParam(input.fechaApertura),
        fecha_cierre: dateParam(input.fechaCierre),
        estado: 'abierta',
        bases_archivo_id: input.basesArchivoId,
        deleted_at: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return {
      id: row.id,
      anio: row.anio,
      fechaApertura: fechaText(row.fecha_apertura),
      fechaCierre: fechaText(row.fecha_cierre),
      estado: row.estado,
      basesArchivoId: row.bases_archivo_id,
      creadoEn: row.creado_en,
    };
  }

  async findConvocatoriaById(id: string): Promise<ConvocatoriaRecord | null> {
    const row = await this.db
      .selectFrom('emisora.convocatoria')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? mapConvocatoria(row) : null;
  }

  async findConvocatoriaByAnio(anio: number): Promise<ConvocatoriaRecord | null> {
    const row = await this.db
      .selectFrom('emisora.convocatoria')
      .selectAll()
      .where('anio', '=', anio)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? mapConvocatoria(row) : null;
  }

  async listConvocatorias(): Promise<readonly ConvocatoriaRecord[]> {
    const rows = await this.db
      .selectFrom('emisora.convocatoria')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('anio', 'desc')
      .execute();
    return rows.map(mapConvocatoria);
  }

  async createRealizador(input: NewRealizador): Promise<RealizadorRecord> {
    const row = await this.db
      .insertInto('emisora.realizador')
      .values({
        id: input.id,
        usuario_id: input.usuarioId,
        nombres: input.nombres,
        apellidos: input.apellidos,
        tipo_documento: input.tipoDocumento,
        numero_documento_cifrado: input.numeroDocumentoCifrado,
        numero_documento_hash: input.numeroDocumentoHash,
        contacto_cifrado: input.contactoCifrado,
        consentimiento_datos: sql<unknown>`${JSON.stringify(input.consentimientoDatos)}::jsonb`,
        municipio: input.municipio,
        fecha_nacimiento: input.fechaNacimiento ? dateParam(input.fechaNacimiento) : null,
        deleted_at: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapRealizador(row);
  }

  async findRealizadorById(id: string): Promise<RealizadorRecord | null> {
    const row = await this.db
      .selectFrom('emisora.realizador')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? mapRealizador(row) : null;
  }

  async updateRealizadorContacto(
    id: string,
    contactoCifrado: string | null,
    municipio: string | null,
  ): Promise<RealizadorRecord> {
    const row = await this.db
      .updateTable('emisora.realizador')
      .set({ contacto_cifrado: contactoCifrado, municipio })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapRealizador(row);
  }

  async createProyecto(input: NewProyecto): Promise<ProyectoRecord> {
    const row = await this.db
      .insertInto('emisora.proyecto_programa')
      .values({
        id: input.id,
        convocatoria_id: input.convocatoriaId,
        realizador_id: input.realizadorId,
        programa_id: input.programaId,
        formador_id: input.formadorId,
        titulo: input.titulo,
        archivo_id: input.archivoId,
        fecha_recepcion: dateParam(input.fechaRecepcion),
        observaciones: input.observaciones,
        deleted_at: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapProyecto(row);
  }

  async findProyectoById(id: string): Promise<ProyectoRecord | null> {
    const row = await this.db
      .selectFrom('emisora.proyecto_programa')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? mapProyecto(row) : null;
  }

  async createComite(input: NewComite): Promise<ComiteRecord> {
    const row = await this.db
      .insertInto('emisora.comite')
      .values({
        id: input.id,
        convocatoria_id: input.convocatoriaId,
        fecha: dateParam(input.fecha),
        acta_archivo_id: input.actaArchivoId,
        integrantes: sql<unknown>`${JSON.stringify(input.integrantes)}::jsonb`,
        conclusiones: input.conclusiones,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapComite(row);
  }

  async findComiteById(id: string): Promise<ComiteRecord | null> {
    const row = await this.db
      .selectFrom('emisora.comite')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapComite(row) : null;
  }

  async findRejillaByAnio(anio: number): Promise<RejillaRecord | null> {
    const row = await this.db
      .selectFrom('emisora.rejilla_anual')
      .selectAll()
      .where('anio', '=', anio)
      .executeTakeFirst();
    return row ? mapRejilla(row) : null;
  }

  async findRejillaById(id: string): Promise<RejillaRecord | null> {
    const row = await this.db
      .selectFrom('emisora.rejilla_anual')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapRejilla(row) : null;
  }

  async vincularComiteRejilla(rejillaId: string, comiteId: string): Promise<void> {
    const row = await this.db
      .updateTable('emisora.rejilla_anual')
      .set({ comite_id: comiteId })
      .where('id', '=', rejillaId)
      .where('estado', '=', 'borrador')
      .returning('id')
      .executeTakeFirst();
    if (!row) {
      throw EmisoraError.conflict(
        'INVALID_STATE_TRANSITION',
        'La rejilla ya no está en borrador y no puede cambiar de acta.',
      );
    }
  }

  async listRejillaItems(rejillaId: string): Promise<readonly RejillaItemRecord[]> {
    const rows = await this.db
      .selectFrom('emisora.rejilla_anual_item')
      .selectAll()
      .where('rejilla_anual_id', '=', rejillaId)
      .orderBy('hora_inicio', 'asc')
      .execute();
    return rows.map(mapRejillaItem);
  }

  async updateRejillaEstado(
    id: string,
    comiteId: string,
    aprobadaEn: Date,
  ): Promise<RejillaRecord> {
    const row = await this.db
      .updateTable('emisora.rejilla_anual')
      .set({ estado: 'aprobada', comite_id: comiteId, aprobada_en: aprobadaEn })
      .where('id', '=', id)
      .where('estado', '=', 'borrador')
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw EmisoraError.conflict(
        'INVALID_STATE_TRANSITION',
        'La rejilla no está en borrador o no existe.',
      );
    }
    return mapRejilla(row);
  }

  async createProgramacion(input: NewProgramacion): Promise<ProgramacionRecord> {
    try {
      await this.db
        .insertInto('emisora.programacion_diaria')
        .values({
          id: input.id,
          rejilla_anual_id: input.rejillaAnualId,
          fecha: dateParam(input.fecha),
          estado: 'borrador',
          concuerda: input.concuerda,
          desviaciones: sql<unknown>`${JSON.stringify(input.desviaciones)}::jsonb`,
          responsable_id: input.responsableId,
        })
        .execute();

      await this.db
        .insertInto('emisora.programacion_item')
        .values(
          input.items.map((item) => ({
            id: item.id,
            programacion_diaria_id: input.id,
            fecha: dateParam(item.fecha),
            hora_inicio: item.horaInicio,
            hora_fin: item.horaFin,
            tipo: item.tipo,
            programa_id: item.programaId,
            promo_id: null,
            titulo: item.titulo,
          })),
        )
        .execute();
    } catch (error) {
      if (esSolape(error)) {
        throw EmisoraError.conflict(
          'SCHEDULE_OVERLAP',
          'Dos franjas de la misma fecha se solapan.',
        );
      }
      throw error;
    }

    const created = await this.findProgramacionById(input.id);
    if (!created) {
      throw EmisoraError.notFound('Programación diaria');
    }
    return created;
  }

  async findProgramacionById(id: string): Promise<ProgramacionRecord | null> {
    const row = await this.db
      .selectFrom('emisora.programacion_diaria')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapProgramacion(row) : null;
  }

  async findProgramacionByFecha(fecha: string): Promise<ProgramacionRecord | null> {
    const row = await this.db
      .selectFrom('emisora.programacion_diaria')
      .selectAll()
      .where('fecha', '=', dateParam(fecha))
      .executeTakeFirst();
    return row ? mapProgramacion(row) : null;
  }

  async listProgramacionItems(programacionId: string): Promise<readonly ProgramacionItemRecord[]> {
    const rows = await this.db
      .selectFrom('emisora.programacion_item')
      .selectAll()
      .where('programacion_diaria_id', '=', programacionId)
      .orderBy('hora_inicio', 'asc')
      .execute();
    return rows.map(mapProgramacionItem);
  }

  async findProgramacionItemById(id: string): Promise<ProgramacionItemRecord | null> {
    const row = await this.db
      .selectFrom('emisora.programacion_item')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapProgramacionItem(row) : null;
  }

  async updateProgramacionEstado(
    id: string,
    estado: 'borrador' | 'aprobada',
    responsableId: string,
  ): Promise<ProgramacionRecord> {
    const row = await this.db
      .updateTable('emisora.programacion_diaria')
      .set({ estado, responsable_id: responsableId })
      .where('id', '=', id)
      .where('estado', '=', 'borrador')
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw EmisoraError.conflict(
        'INVALID_STATE_TRANSITION',
        'La programación no está en borrador o no existe.',
      );
    }
    return mapProgramacion(row);
  }

  async createGrabacion(input: NewGrabacion): Promise<GrabacionRecord> {
    const row = await this.db
      .insertInto('emisora.sesion_grabacion')
      .values({
        id: input.id,
        programacion_item_id: input.programacionItemId,
        fecha: dateParam(input.fecha),
        responsable_id: input.responsableId,
        aprobada_por: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapGrabacion(row);
  }

  async findGrabacionById(id: string): Promise<GrabacionRecord | null> {
    const row = await this.db
      .selectFrom('emisora.sesion_grabacion')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapGrabacion(row) : null;
  }

  async listGrabaciones(): Promise<readonly GrabacionRecord[]> {
    const rows = await this.db
      .selectFrom('emisora.sesion_grabacion')
      .selectAll()
      .orderBy('creado_en', 'desc')
      .execute();
    return rows.map(mapGrabacion);
  }

  async updateGrabacionEstado(
    id: string,
    from: GrabacionRecord['estado'],
    estado: GrabacionRecord['estado'],
    aprobadaPor: string,
  ): Promise<GrabacionRecord> {
    const row = await this.db
      .updateTable('emisora.sesion_grabacion')
      .set({ estado, aprobada_por: aprobadaPor })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw EmisoraError.invalidTransition(from, estado);
    }
    return mapGrabacion(row);
  }

  async replaceAsistencia(
    sesionId: string,
    entries: readonly NewAsistencia[],
  ): Promise<AsistenciaRecord[]> {
    await this.db
      .deleteFrom('emisora.asistencia_cabina')
      .where('sesion_id', '=', sesionId)
      .execute();
    if (entries.length === 0) {
      return [];
    }
    const rows = await this.db
      .insertInto('emisora.asistencia_cabina')
      .values(
        entries.map((entry) => ({
          id: uuidv7(),
          sesion_id: sesionId,
          usuario_id: entry.usuarioId,
          estado: entry.estado,
        })),
      )
      .returningAll()
      .execute();
    return rows.map((row) => ({
      sesionId: row.sesion_id,
      usuarioId: row.usuario_id,
      estado: row.estado,
      registradoEn: row.registrado_en,
    }));
  }

  async listAsistencia(sesionId: string): Promise<readonly AsistenciaRecord[]> {
    const rows = await this.db
      .selectFrom('emisora.asistencia_cabina')
      .selectAll()
      .where('sesion_id', '=', sesionId)
      .execute();
    return rows.map((row) => ({
      sesionId: row.sesion_id,
      usuarioId: row.usuario_id,
      estado: row.estado,
      registradoEn: row.registrado_en,
    }));
  }

  async createAudio(input: NewAudio): Promise<AudioRecord> {
    const row = await this.db
      .insertInto('emisora.audio')
      .values({
        id: input.id,
        sesion_grabacion_id: input.sesionGrabacionId,
        tipo: input.tipo,
        duracion_segundos: input.duracionSegundos,
        fecha: dateParam(input.fecha),
        responsable_id: input.responsableId,
        archivo_id: input.archivoId,
        hash_sha256: input.hashSha256,
        deleted_at: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapAudio(row);
  }

  async findAudioById(id: string): Promise<AudioRecord | null> {
    const row = await this.db
      .selectFrom('emisora.audio')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? mapAudio(row) : null;
  }

  async listAudio(sesionId: string | null): Promise<readonly AudioRecord[]> {
    let query = this.db.selectFrom('emisora.audio').selectAll();
    if (sesionId) {
      query = query.where('sesion_grabacion_id', '=', sesionId);
    }
    const rows = await query.where('deleted_at', 'is', null).orderBy('creado_en', 'desc').execute();
    return rows.map(mapAudio);
  }

  async createInforme(input: NewInforme): Promise<InformeRecord> {
    const row = await this.db
      .insertInto('emisora.informe_realizador')
      .values({
        id: input.id,
        proyecto_id: input.proyectoId,
        realizador_id: input.realizadorId,
        fecha_informe: dateParam(input.fechaInforme),
        archivo_id: input.archivoId,
        observaciones: input.observaciones,
        calificacion: null,
        evaluado_por: null,
        evaluado_en: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapInforme(row);
  }

  async findInformeById(id: string): Promise<InformeRecord | null> {
    const row = await this.db
      .selectFrom('emisora.informe_realizador')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapInforme(row) : null;
  }

  async createIncentivo(input: {
    id: string;
    informeId: string;
    comiteId: string | null;
    realizadorId: string;
  }): Promise<IncentivoRecord> {
    const row = await this.db
      .insertInto('emisora.incentivo')
      .values({
        id: input.id,
        informe_id: input.informeId,
        comite_id: input.comiteId,
        realizador_id: input.realizadorId,
        calificacion: null,
        referencia_cdp: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapIncentivo(row);
  }

  async findIncentivoById(id: string): Promise<IncentivoRecord | null> {
    const row = await this.db
      .selectFrom('emisora.incentivo')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapIncentivo(row) : null;
  }

  async updateIncentivo(
    id: string,
    from: IncentivoEstado,
    estado: IncentivoEstado,
    calificacion: number | null,
    referenciaCdp: string | null,
  ): Promise<IncentivoRecord> {
    const row = await this.db
      .updateTable('emisora.incentivo')
      .set({ estado, calificacion, referencia_cdp: referenciaCdp })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw EmisoraError.invalidTransition(from, estado);
    }
    return mapIncentivo(row);
  }

  async listIncentivos(): Promise<readonly IncentivoRecord[]> {
    const rows = await this.db
      .selectFrom('emisora.incentivo')
      .selectAll()
      .orderBy('creado_en', 'desc')
      .execute();
    return rows.map(mapIncentivo);
  }
}

/* ------------------------------- Mapeadores ------------------------------ */

function mapConvocatoria(row: {
  id: string;
  anio: number;
  fecha_apertura: Date | string;
  fecha_cierre: Date | string;
  estado: ConvocatoriaRecord['estado'];
  bases_archivo_id: string | null;
  creado_en: Date;
}): ConvocatoriaRecord {
  return {
    id: row.id,
    anio: row.anio,
    fechaApertura: fechaText(row.fecha_apertura),
    fechaCierre: fechaText(row.fecha_cierre),
    estado: row.estado,
    basesArchivoId: row.bases_archivo_id,
    creadoEn: row.creado_en,
  };
}

function mapRealizador(row: {
  id: string;
  usuario_id: string | null;
  nombres: string;
  apellidos: string;
  municipio: string | null;
  creado_en: Date;
}): RealizadorRecord {
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    nombres: row.nombres,
    apellidos: row.apellidos,
    municipio: row.municipio,
    creadoEn: row.creado_en,
  };
}

function mapProyecto(row: {
  id: string;
  convocatoria_id: string;
  realizador_id: string;
  titulo: string;
  archivo_id: string;
  fecha_recepcion: Date | string;
  estado: ProyectoRecord['estado'];
  creado_en: Date;
}): ProyectoRecord {
  return {
    id: row.id,
    convocatoriaId: row.convocatoria_id,
    realizadorId: row.realizador_id,
    titulo: row.titulo,
    archivoId: row.archivo_id,
    fechaRecepcion: fechaText(row.fecha_recepcion),
    estado: row.estado,
    creadoEn: row.creado_en,
  };
}

function mapComite(row: {
  id: string;
  convocatoria_id: string;
  fecha: Date | string;
  acta_archivo_id: string | null;
  integrantes: unknown;
  conclusiones: string | null;
}): ComiteRecord {
  return {
    id: row.id,
    convocatoriaId: row.convocatoria_id,
    fecha: fechaText(row.fecha),
    actaArchivoId: row.acta_archivo_id,
    integrantes: textoArray(row.integrantes),
    conclusiones: row.conclusiones,
  };
}

function mapRejilla(row: {
  id: string;
  anio: number;
  comite_id: string | null;
  estado: RejillaRecord['estado'];
  aprobada_en: Date | null;
  creado_en: Date;
}): RejillaRecord {
  return {
    id: row.id,
    anio: row.anio,
    comiteId: row.comite_id,
    estado: row.estado,
    aprobadaEn: row.aprobada_en,
    creadoEn: row.creado_en,
  };
}

function mapRejillaItem(row: {
  id: string;
  rejilla_anual_id: string;
  fecha: Date | string | null;
  dia_semana: number | null;
  hora_inicio: string;
  hora_fin: string;
  tipo: RejillaItemRecord['tipo'];
  programa_id: string | null;
  nombre: string;
}): RejillaItemRecord {
  return {
    id: row.id,
    rejillaAnualId: row.rejilla_anual_id,
    fecha: row.fecha ? fechaText(row.fecha) : null,
    diaSemana: row.dia_semana,
    horaInicio: horaText(row.hora_inicio),
    horaFin: horaText(row.hora_fin),
    tipo: row.tipo,
    programaId: row.programa_id,
    nombre: row.nombre,
  };
}

function mapProgramacion(row: {
  id: string;
  rejilla_anual_id: string;
  fecha: Date | string;
  estado: ProgramacionRecord['estado'];
  concuerda: boolean | null;
  desviaciones: unknown;
  responsable_id: string | null;
  creado_en: Date;
}): ProgramacionRecord {
  return {
    id: row.id,
    rejillaAnualId: row.rejilla_anual_id,
    fecha: fechaText(row.fecha),
    estado: row.estado,
    concuerda: row.concuerda,
    desviaciones: textoArray(row.desviaciones),
    responsableId: row.responsable_id,
    creadoEn: row.creado_en,
  };
}

function mapProgramacionItem(row: {
  id: string;
  programacion_diaria_id: string;
  fecha: Date | string;
  hora_inicio: string;
  hora_fin: string;
  tipo: ProgramacionItemRecord['tipo'];
  programa_id: string | null;
  titulo: string;
}): ProgramacionItemRecord {
  return {
    id: row.id,
    programacionDiariaId: row.programacion_diaria_id,
    fecha: fechaText(row.fecha),
    horaInicio: horaText(row.hora_inicio),
    horaFin: horaText(row.hora_fin),
    tipo: row.tipo,
    programaId: row.programa_id,
    titulo: row.titulo,
  };
}

function mapGrabacion(row: {
  id: string;
  programacion_item_id: string | null;
  fecha: Date | string;
  estado: GrabacionRecord['estado'];
  responsable_id: string | null;
  aprobada_por: string | null;
  creado_en: Date;
}): GrabacionRecord {
  return {
    id: row.id,
    programacionItemId: row.programacion_item_id,
    fecha: fechaText(row.fecha),
    estado: row.estado,
    responsableId: row.responsable_id,
    aprobadaPor: row.aprobada_por,
    creadoEn: row.creado_en,
  };
}

function mapAudio(row: {
  id: string;
  sesion_grabacion_id: string;
  tipo: AudioRecord['tipo'];
  duracion_segundos: number;
  fecha: Date | string;
  responsable_id: string;
  archivo_id: string;
  hash_sha256: string | null;
  creado_en: Date;
}): AudioRecord {
  return {
    id: row.id,
    sesionGrabacionId: row.sesion_grabacion_id,
    tipo: row.tipo,
    duracionSegundos: row.duracion_segundos,
    fecha: fechaText(row.fecha),
    responsableId: row.responsable_id,
    archivoId: row.archivo_id,
    hashSha256: row.hash_sha256,
    creadoEn: row.creado_en,
  };
}

function mapInforme(row: {
  id: string;
  proyecto_id: string;
  realizador_id: string;
  fecha_informe: Date | string;
  estado: InformeRecord['estado'];
  archivo_id: string;
  creado_en: Date;
}): InformeRecord {
  return {
    id: row.id,
    proyectoId: row.proyecto_id,
    realizadorId: row.realizador_id,
    fechaInforme: fechaText(row.fecha_informe),
    estado: row.estado,
    archivoId: row.archivo_id,
    creadoEn: row.creado_en,
  };
}

function mapIncentivo(row: {
  id: string;
  informe_id: string;
  comite_id: string | null;
  realizador_id: string;
  estado: IncentivoEstado;
  calificacion: number | null;
  referencia_cdp: string | null;
  creado_en: Date;
}): IncentivoRecord {
  return {
    id: row.id,
    informeId: row.informe_id,
    comiteId: row.comite_id,
    realizadorId: row.realizador_id,
    estado: row.estado,
    calificacion: row.calificacion,
    referenciaCdp: row.referencia_cdp,
    creadoEn: row.creado_en,
  };
}
