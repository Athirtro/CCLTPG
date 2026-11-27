import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { v7 as uuidv7 } from 'uuid';

import type { Database } from '../../../../database/schema.js';
import type {
  ActualizacionEstado,
  EquipoEstado,
  IncentivoEstado,
  InversionEstado,
  OrdenEmisionEstado,
  PatrocinioEstado,
  PermisoEstado,
  PlanillaEstado,
  PrestamoEstado,
  ProyeccionEstado,
  PromoEstado,
  PublicacionEstado,
  TramiteEstado,
  TransmisionEstado,
  TurnoEstado,
} from '../../domain/emisora-states.js';
import { EmisoraError } from '../../application/emisora-error.js';
import type {
  ActualizacionRecord,
  ActividadCulturalRecord,
  ArchivoEmisoraRecord,
  AsignacionEquipoRecord,
  AsistenciaRecord,
  AudioRecord,
  BitacoraRecord,
  ComiteRecord,
  ConvocatoriaRecord,
  EquipoRecord,
  GrabacionRecord,
  IncentivoRecord,
  InformeRecord,
  InversionRecord,
  LecturaRecord,
  ObraRecord,
  OrdenEmisionRecord,
  PagoDerechosRecord,
  PatrocinioRecord,
  PermisoGobiernoRecord,
  PlanillaRecord,
  PrestamoMifiRecord,
  ProyeccionRecord,
  ProgramacionItemRecord,
  ProgramacionRecord,
  PromoRecord,
  ProyectoRecord,
  PublicacionRecord,
  RealizadorRecord,
  ReporteDesplazamientoRecord,
  ReporteObraRecord,
  ResolucionRecord,
  RejillaItemRecord,
  RejillaRecord,
  SalidaEquipoRecord,
  SoporteTramiteRecord,
  TransmisionRecord,
  TransmisorRecord,
  TramiteRecord,
  TurnoRecord,
  VersionSoftwareRecord,
  ViaticoRecord,
} from '../../application/emisora.types.js';
import {
  type EmisoraRepository,
  type NewAsistencia,
  type NewAudio,
  type NewActualizacion,
  type NewActividadCultural,
  type NewArchivoEmisora,
  type NewAsignacionEquipo,
  type NewBitacora,
  type NewComite,
  type NewConvocatoria,
  type NewEquipo,
  type NewGrabacion,
  type NewInforme,
  type NewInversion,
  type NewLectura,
  type NewObra,
  type NewOrdenEmision,
  type NewPagoDerechos,
  type NewPatrocinio,
  type NewPermisoGobierno,
  type NewPlanilla,
  type NewPrestamoMifi,
  type NewProyeccion,
  type NewProgramacion,
  type NewPromo,
  type NewProyecto,
  type NewPublicacion,
  type NewRealizador,
  type NewReporteDesplazamiento,
  type NewReporteObra,
  type NewResolucion,
  type NewSalidaEquipo,
  type NewSoporteTramite,
  type NewTramite,
  type NewTransmision,
  type NewTurno,
  type NewVersionSoftware,
  type NewViatico,
} from '../../application/ports/emisora.repository.js';

/** Fecha de calendario enlazada como `date`, sin desplazamiento de zona. */
const dateParam = (valor: string) => sql<Date>`${valor}::date`;

/** La bitácora exige UUID en `request_id`; correlaciona cuando es posible. */
function requestIdParam(valor: string | null): string {
  return valor &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)
    ? valor
    : uuidv7();
}

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

/** Una restricción única es un conflicto de dominio, nunca un 500 (E4). */
function choqueUnico(error: unknown, constraint: string, conflicto: () => EmisoraError): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === constraint
  ) {
    throw conflicto();
  }
  throw error;
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

  /* -------------------------------- E3 --------------------------------- */

  async createResolucion(input: NewResolucion): Promise<ResolucionRecord> {
    try {
      const row = await this.db
        .insertInto('emisora.resolucion_incentivo')
        .values({
          id: input.id,
          incentivo_id: input.incentivoId,
          pdf_archivo_id: input.pdfArchivoId,
          referencia_cdp: input.referenciaCdp,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return mapResolucion(row);
    } catch (error) {
      // Dos claves distintas pueden ganar la comprobación previa de duplicado;
      // la restricción única decide y el perdedor debe recibir 409, no un 500.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505' &&
        'constraint' in error &&
        error.constraint === 'resolucion_incentivo_incentivo_key'
      ) {
        throw EmisoraError.resolucionYaExistente();
      }
      throw error;
    }
  }

  async findResolucionById(id: string): Promise<ResolucionRecord | null> {
    const row = await this.db
      .selectFrom('emisora.resolucion_incentivo')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapResolucion(row) : null;
  }

  async findResolucionByIncentivoId(incentivoId: string): Promise<ResolucionRecord | null> {
    const row = await this.db
      .selectFrom('emisora.resolucion_incentivo')
      .selectAll()
      .where('incentivo_id', '=', incentivoId)
      .executeTakeFirst();
    return row ? mapResolucion(row) : null;
  }

  async createPatrocinio(input: NewPatrocinio): Promise<PatrocinioRecord> {
    const row = await this.db
      .insertInto('emisora.patrocinio')
      .values({
        id: input.id,
        nombre: input.nombre,
        entidad: input.entidad,
        fecha_inicio: input.fechaInicio ? dateParam(input.fechaInicio) : null,
        fecha_fin: input.fechaFin ? dateParam(input.fechaFin) : null,
        contrato_archivo_id: input.contratoArchivoId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapPatrocinio(row);
  }

  async findPatrocinioById(id: string): Promise<PatrocinioRecord | null> {
    const row = await this.db
      .selectFrom('emisora.patrocinio')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? mapPatrocinio(row) : null;
  }

  async updatePatrocinioEstado(
    id: string,
    from: PatrocinioEstado,
    estado: PatrocinioEstado,
    contratoArchivoId: string | null,
  ): Promise<PatrocinioRecord> {
    const row = await this.db
      .updateTable('emisora.patrocinio')
      .set({ estado, contrato_archivo_id: contratoArchivoId })
      .where('id', '=', id)
      .where('estado', '=', from)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapPatrocinio(row);
  }

  async createPromo(input: NewPromo): Promise<PromoRecord> {
    const row = await this.db
      .insertInto('emisora.promo')
      .values({
        id: input.id,
        patrocinio_id: input.patrocinioId,
        nombre: input.nombre,
        guion: input.guion,
        duracion_segundos: input.duracionSegundos,
        audio_archivo_id: input.audioArchivoId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapPromo(row);
  }

  async findPromoById(id: string): Promise<PromoRecord | null> {
    const row = await this.db
      .selectFrom('emisora.promo')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? mapPromo(row) : null;
  }

  async updatePromoEstado(
    id: string,
    from: PromoEstado,
    estado: PromoEstado,
    audioArchivoId: string | null,
  ): Promise<PromoRecord> {
    const row = await this.db
      .updateTable('emisora.promo')
      .set({ estado, audio_archivo_id: audioArchivoId })
      .where('id', '=', id)
      .where('estado', '=', from)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapPromo(row);
  }

  async createOrden(input: NewOrdenEmision): Promise<OrdenEmisionRecord> {
    const row = await this.db
      .insertInto('emisora.orden_emision')
      .values({
        id: input.id,
        promo_id: input.promoId,
        programacion_item_id: input.programacionItemId,
        fecha_emision: input.fechaEmision ? dateParam(input.fechaEmision) : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapOrden(row);
  }

  async findOrdenById(id: string): Promise<OrdenEmisionRecord | null> {
    const row = await this.db
      .selectFrom('emisora.orden_emision')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapOrden(row) : null;
  }

  async updateOrdenEstado(
    id: string,
    from: OrdenEmisionEstado,
    estado: OrdenEmisionEstado,
    emitidaEn: Date | null,
  ): Promise<OrdenEmisionRecord> {
    const row = await this.db
      .updateTable('emisora.orden_emision')
      .set({ estado, emitida_en: emitidaEn })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapOrden(row);
  }

  async createPublicacion(input: NewPublicacion): Promise<PublicacionRecord> {
    const row = await this.db
      .insertInto('emisora.publicacion')
      .values({
        id: input.id,
        promo_id: input.promoId,
        canal: input.canal,
        fecha_publicacion: dateParam(input.fechaPublicacion),
        archivo_id: input.archivoId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapPublicacion(row);
  }

  async findPublicacionById(id: string): Promise<PublicacionRecord | null> {
    const row = await this.db
      .selectFrom('emisora.publicacion')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapPublicacion(row) : null;
  }

  async updatePublicacionEstado(
    id: string,
    from: PublicacionEstado,
    estado: PublicacionEstado,
    publicadaEn: Date | null,
    archivoId: string | null,
  ): Promise<PublicacionRecord> {
    const row = await this.db
      .updateTable('emisora.publicacion')
      .set({ estado, publicada_en: publicadaEn, archivo_id: archivoId })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapPublicacion(row);
  }

  async createTransmision(input: NewTransmision): Promise<TransmisionRecord> {
    const row = await this.db
      .insertInto('emisora.transmision')
      .values({
        id: input.id,
        programacion_item_id: input.programacionItemId,
        fecha_transmision: dateParam(input.fechaTransmision),
        es_fuera_ciudad: input.esFueraCiudad,
        destino: input.destino,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapTransmision(row);
  }

  async findTransmisionById(id: string): Promise<TransmisionRecord | null> {
    const row = await this.db
      .selectFrom('emisora.transmision')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapTransmision(row) : null;
  }

  async updateTransmisionEstado(
    id: string,
    from: TransmisionEstado,
    estado: TransmisionEstado,
    autorizadaPor: string | null,
    autorizadaEn: Date | null,
  ): Promise<TransmisionRecord> {
    const row = await this.db
      .updateTable('emisora.transmision')
      .set({ estado, autorizada_por: autorizadaPor, autorizada_en: autorizadaEn })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapTransmision(row);
  }

  async createSalidaEquipo(input: NewSalidaEquipo): Promise<SalidaEquipoRecord> {
    const row = await this.db
      .insertInto('emisora.salida_equipo')
      .values({
        id: input.id,
        transmision_id: input.transmisionId,
        equipo_id: input.equipoId,
        responsable_id: input.responsableId,
        fecha_salida: input.fechaSalida,
        observaciones: input.observaciones,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapSalida(row);
  }

  async findSalidaEquipoByTransmision(
    transmisionId: string,
  ): Promise<readonly SalidaEquipoRecord[]> {
    const rows = await this.db
      .selectFrom('emisora.salida_equipo')
      .selectAll()
      .where('transmision_id', '=', transmisionId)
      .orderBy('creado_en', 'desc')
      .execute();
    return rows.map(mapSalida);
  }

  async devolverSalidaEquipo(id: string, fechaDevolucion: Date): Promise<SalidaEquipoRecord> {
    const row = await this.db
      .updateTable('emisora.salida_equipo')
      .set({ fecha_devolucion: fechaDevolucion })
      .where('id', '=', id)
      .where('fecha_devolucion', 'is', null)
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw EmisoraError.conflict(
        'INVALID_STATE_TRANSITION',
        'La salida de equipo ya tiene fecha de devolución.',
      );
    }
    return mapSalida(row);
  }

  async createReporteDesplazamiento(
    input: NewReporteDesplazamiento,
  ): Promise<ReporteDesplazamientoRecord> {
    const row = await this.db
      .insertInto('emisora.reporte_desplazamiento')
      .values({
        id: input.id,
        transmision_id: input.transmisionId,
        conductor_id: input.conductorId,
        vehiculo: input.vehiculo,
        hora_salida: input.horaSalida,
        hora_llegada: input.horaLlegada,
        novedades: input.novedades,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapReporte(row);
  }

  async findReporteDesplazamientoByTransmision(
    transmisionId: string,
  ): Promise<ReporteDesplazamientoRecord | null> {
    const row = await this.db
      .selectFrom('emisora.reporte_desplazamiento')
      .selectAll()
      .where('transmision_id', '=', transmisionId)
      .executeTakeFirst();
    return row ? mapReporte(row) : null;
  }

  async createPrestamoMifi(input: NewPrestamoMifi): Promise<PrestamoMifiRecord> {
    const row = await this.db
      .insertInto('emisora.prestamo_mifi')
      .values({
        id: input.id,
        transmision_id: input.transmisionId,
        usuario_id: input.usuarioId,
        fecha_solicitud: input.fechaSolicitud,
        fecha_transmision: dateParam(input.fechaTransmision),
        observaciones: input.observaciones,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapPrestamo(row);
  }

  async findPrestamoMifiById(id: string): Promise<PrestamoMifiRecord | null> {
    const row = await this.db
      .selectFrom('emisora.prestamo_mifi')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapPrestamo(row) : null;
  }

  async updatePrestamoMifiEstado(
    id: string,
    from: PrestamoEstado,
    estado: PrestamoEstado,
  ): Promise<PrestamoMifiRecord> {
    const row = await this.db
      .updateTable('emisora.prestamo_mifi')
      .set({ estado })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapPrestamo(row);
  }

  async createViatico(input: NewViatico): Promise<ViaticoRecord> {
    const row = await this.db
      .insertInto('emisora.viatico')
      .values({
        id: input.id,
        transmision_id: input.transmisionId,
        usuario_id: input.usuarioId,
        soporte_archivo_id: input.soporteArchivoId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapViatico(row);
  }

  async findViaticoById(id: string): Promise<ViaticoRecord | null> {
    const row = await this.db
      .selectFrom('emisora.viatico')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapViatico(row) : null;
  }

  /* -------------------------------- E4 ---------------------------------- */

  async findTransmisorById(id: string): Promise<TransmisorRecord | null> {
    const row = await this.db
      .selectFrom('emisora.transmisor')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? mapTransmisor(row) : null;
  }

  async createTurno(input: NewTurno): Promise<TurnoRecord> {
    const row = await this.db
      .insertInto('emisora.turno_operador')
      .values({
        id: input.id,
        transmisor_id: input.transmisorId,
        operador_id: input.operadorId,
        fecha: dateParam(input.fecha),
        hora_inicio: input.horaInicio,
        hora_fin: input.horaFin,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapTurno(row);
  }

  async findTurnoById(id: string): Promise<TurnoRecord | null> {
    const row = await this.db
      .selectFrom('emisora.turno_operador')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapTurno(row) : null;
  }

  async updateTurnoEstado(
    id: string,
    from: TurnoEstado,
    estado: TurnoEstado,
  ): Promise<TurnoRecord> {
    const row = await this.db
      .updateTable('emisora.turno_operador')
      .set({ estado })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapTurno(row);
  }

  async createLectura(input: NewLectura): Promise<LecturaRecord> {
    try {
      const row = await this.db
        .insertInto('emisora.lectura_transmisor')
        .values({
          id: input.id,
          transmisor_id: input.transmisorId,
          fecha: dateParam(input.fecha),
          potencia_w: input.potenciaW,
          frecuencia: input.frecuencia,
          observaciones: input.observaciones,
          registrado_por: input.registradoPor,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return mapLectura(row);
    } catch (error) {
      choqueUnico(error, 'lectura_transmisor_transmisor_fecha_key', () =>
        EmisoraError.lecturaDuplicada(),
      );
    }
  }

  async findLecturaByTransmisorFecha(
    transmisorId: string,
    fecha: string,
  ): Promise<LecturaRecord | null> {
    const row = await this.db
      .selectFrom('emisora.lectura_transmisor')
      .selectAll()
      .where('transmisor_id', '=', transmisorId)
      .where('fecha', '=', dateParam(fecha))
      .executeTakeFirst();
    return row ? mapLectura(row) : null;
  }

  async listLecturas(transmisorId: string | null): Promise<readonly LecturaRecord[]> {
    let consulta = this.db.selectFrom('emisora.lectura_transmisor').selectAll();
    if (transmisorId) {
      consulta = consulta.where('transmisor_id', '=', transmisorId);
    }
    const rows = await consulta.orderBy('fecha', 'desc').execute();
    return rows.map(mapLectura);
  }

  async createBitacora(input: NewBitacora): Promise<BitacoraRecord> {
    const row = await this.db
      .insertInto('emisora.bitacora_sede')
      .values({
        id: input.id,
        transmisor_id: input.transmisorId,
        turno_id: input.turnoId,
        fecha: dateParam(input.fecha),
        incidente: input.incidente,
        accion: input.accion,
        actor_id: input.actorId,
        request_id: requestIdParam(input.requestId),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapBitacora(row);
  }

  async createObra(input: NewObra): Promise<ObraRecord> {
    const row = await this.db
      .insertInto('emisora.obra')
      .values({
        id: input.id,
        titulo: input.titulo,
        compositor_autor: input.compositorAutor,
        duracion_segundos: input.duracionSegundos,
        fecha_inclusion: dateParam(input.fechaInclusion),
        archivo_id: input.archivoId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapObra(row);
  }

  async findObraById(id: string): Promise<ObraRecord | null> {
    const row = await this.db
      .selectFrom('emisora.obra')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? mapObra(row) : null;
  }

  async listObras(): Promise<readonly ObraRecord[]> {
    const rows = await this.db
      .selectFrom('emisora.obra')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('fecha_inclusion', 'desc')
      .execute();
    return rows.map(mapObra);
  }

  async createReporteObra(input: NewReporteObra): Promise<ReporteObraRecord> {
    const row = await this.db
      .insertInto('emisora.reporte_obra')
      .values({
        id: input.id,
        entidad: input.entidad,
        periodo: input.periodo,
        fecha_inicio: dateParam(input.fechaInicio),
        fecha_fin: dateParam(input.fechaFin),
        archivo_id: input.archivoId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapReporteObra(row);
  }

  async createPagoDerechos(input: NewPagoDerechos): Promise<PagoDerechosRecord> {
    const row = await this.db
      .insertInto('emisora.pago_derechos')
      .values({
        id: input.id,
        obra_id: input.obraId,
        reporte_id: input.reporteId,
        soporte_archivo_id: input.soporteArchivoId,
        referencia: input.referencia,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapPago(row);
  }

  async findPagoDerechosById(id: string): Promise<PagoDerechosRecord | null> {
    const row = await this.db
      .selectFrom('emisora.pago_derechos')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapPago(row) : null;
  }

  async createEquipo(input: NewEquipo): Promise<EquipoRecord> {
    try {
      const row = await this.db
        .insertInto('emisora.hoja_vida_equipo')
        .values({
          id: input.id,
          nombre: input.nombre,
          tipo: input.tipo,
          marca: input.marca,
          modelo: input.modelo,
          numero_serie: input.numeroSerie,
          fecha_adquisicion: input.fechaAdquisicion ? dateParam(input.fechaAdquisicion) : null,
          archivo_id: input.archivoId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return mapEquipo(row);
    } catch (error) {
      choqueUnico(error, 'hoja_vida_equipo_serie_key', () => EmisoraError.equipoDuplicado());
    }
  }

  async findEquipoById(id: string): Promise<EquipoRecord | null> {
    const row = await this.db
      .selectFrom('emisora.hoja_vida_equipo')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? mapEquipo(row) : null;
  }

  async updateEquipoEstado(id: string, estado: EquipoEstado): Promise<EquipoRecord> {
    const row = await this.db
      .updateTable('emisora.hoja_vida_equipo')
      .set({ estado })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.notFound('Equipo');
    return mapEquipo(row);
  }

  async createActualizacion(input: NewActualizacion): Promise<ActualizacionRecord> {
    const row = await this.db
      .insertInto('emisora.actualizacion_tecnologica')
      .values({
        id: input.id,
        equipo_id: input.equipoId,
        descripcion: input.descripcion,
        solicitada_por: input.solicitadaPor,
        fecha: input.fecha ? dateParam(input.fecha) : null,
        soporte_archivo_id: input.soporteArchivoId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapActualizacion(row);
  }

  async findActualizacionById(id: string): Promise<ActualizacionRecord | null> {
    const row = await this.db
      .selectFrom('emisora.actualizacion_tecnologica')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapActualizacion(row) : null;
  }

  async updateActualizacionEstado(
    id: string,
    from: ActualizacionEstado,
    estado: ActualizacionEstado,
  ): Promise<ActualizacionRecord> {
    const row = await this.db
      .updateTable('emisora.actualizacion_tecnologica')
      .set({ estado })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapActualizacion(row);
  }

  async createProyeccion(input: NewProyeccion): Promise<ProyeccionRecord> {
    try {
      const row = await this.db
        .insertInto('emisora.proyeccion_anual')
        .values({
          id: input.id,
          anio: input.anio,
          equipo_id: input.equipoId,
          descripcion: input.descripcion,
          archivo_id: input.archivoId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return mapProyeccion(row);
    } catch (error) {
      choqueUnico(error, 'proyeccion_anual_anio_key', () => EmisoraError.proyeccionDuplicada());
    }
  }

  async findProyeccionById(id: string): Promise<ProyeccionRecord | null> {
    const row = await this.db
      .selectFrom('emisora.proyeccion_anual')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapProyeccion(row) : null;
  }

  async findProyeccionByAnio(anio: number): Promise<ProyeccionRecord | null> {
    const row = await this.db
      .selectFrom('emisora.proyeccion_anual')
      .selectAll()
      .where('anio', '=', anio)
      .executeTakeFirst();
    return row ? mapProyeccion(row) : null;
  }

  async updateProyeccionEstado(
    id: string,
    from: ProyeccionEstado,
    estado: ProyeccionEstado,
  ): Promise<ProyeccionRecord> {
    const row = await this.db
      .updateTable('emisora.proyeccion_anual')
      .set({ estado })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapProyeccion(row);
  }

  async createInversion(input: NewInversion): Promise<InversionRecord> {
    const row = await this.db
      .insertInto('emisora.inversion_seguimiento')
      .values({
        id: input.id,
        proyeccion_id: input.proyeccionId,
        contrato_ref: input.contratoRef,
        fecha_inicio: input.fechaInicio ? dateParam(input.fechaInicio) : null,
        fecha_fin: input.fechaFin ? dateParam(input.fechaFin) : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapInversion(row);
  }

  async findInversionById(id: string): Promise<InversionRecord | null> {
    const row = await this.db
      .selectFrom('emisora.inversion_seguimiento')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapInversion(row) : null;
  }

  async updateInversionEstado(
    id: string,
    from: InversionEstado,
    estado: InversionEstado,
    contratoRef: string | null,
  ): Promise<InversionRecord> {
    const row = await this.db
      .updateTable('emisora.inversion_seguimiento')
      .set({ estado, contrato_ref: contratoRef ?? undefined })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapInversion(row);
  }

  async createVersionSoftware(input: NewVersionSoftware): Promise<VersionSoftwareRecord> {
    const row = await this.db
      .insertInto('emisora.version_software')
      .values({
        id: input.id,
        equipo_id: input.equipoId,
        nombre: input.nombre,
        version: input.version,
        fecha_instalacion: dateParam(input.fechaInstalacion),
        responsable_id: input.responsableId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapVersionSoftware(row);
  }

  async createAsignacionEquipo(input: NewAsignacionEquipo): Promise<AsignacionEquipoRecord> {
    const row = await this.db
      .insertInto('emisora.asignacion_equipo')
      .values({
        id: input.id,
        equipo_id: input.equipoId,
        transmisor_id: input.transmisorId,
        usuario_id: input.usuarioId,
        fecha_asignacion: dateParam(input.fechaAsignacion),
        fecha_devolucion: input.fechaDevolucion ? dateParam(input.fechaDevolucion) : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapAsignacion(row);
  }

  async createActividad(input: NewActividadCultural): Promise<ActividadCulturalRecord> {
    const row = await this.db
      .insertInto('emisora.actividad_cultural')
      .values({
        id: input.id,
        nombre: input.nombre,
        fecha: dateParam(input.fecha),
        lugar: input.lugar,
        descripcion: input.descripcion,
        responsable_id: input.responsableId,
        archivo_id: input.archivoId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapActividad(row);
  }

  async findActividadById(id: string): Promise<ActividadCulturalRecord | null> {
    const row = await this.db
      .selectFrom('emisora.actividad_cultural')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? mapActividad(row) : null;
  }

  async listActividades(): Promise<readonly ActividadCulturalRecord[]> {
    const rows = await this.db
      .selectFrom('emisora.actividad_cultural')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('fecha', 'desc')
      .execute();
    return rows.map(mapActividad);
  }

  async createPermisoGobierno(input: NewPermisoGobierno): Promise<PermisoGobiernoRecord> {
    const row = await this.db
      .insertInto('emisora.permiso_gobierno')
      .values({
        id: input.id,
        actividad_id: input.actividadId,
        oficio_archivo_id: input.oficioArchivoId,
        destino: input.destino,
        fecha_emision: input.fechaEmision ? dateParam(input.fechaEmision) : null,
        estado: input.estado,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapPermiso(row);
  }

  async findPermisoGobiernoById(id: string): Promise<PermisoGobiernoRecord | null> {
    const row = await this.db
      .selectFrom('emisora.permiso_gobierno')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapPermiso(row) : null;
  }

  async updatePermisoEstado(
    id: string,
    from: PermisoEstado,
    estado: PermisoEstado,
  ): Promise<PermisoGobiernoRecord> {
    const row = await this.db
      .updateTable('emisora.permiso_gobierno')
      .set({ estado })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapPermiso(row);
  }

  async createTramite(input: NewTramite): Promise<TramiteRecord> {
    const row = await this.db
      .insertInto('emisora.tramite_externo')
      .values({
        id: input.id,
        destino: input.destino,
        asunto: input.asunto,
        radicado_ref: input.radicadoRef,
        fecha_radicacion: dateParam(input.fechaRadicacion),
        responsable_id: input.responsableId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapTramite(row);
  }

  async findTramiteById(id: string): Promise<TramiteRecord | null> {
    const row = await this.db
      .selectFrom('emisora.tramite_externo')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapTramite(row) : null;
  }

  async listTramites(): Promise<readonly TramiteRecord[]> {
    const rows = await this.db
      .selectFrom('emisora.tramite_externo')
      .selectAll()
      .orderBy('fecha_radicacion', 'desc')
      .execute();
    return rows.map(mapTramite);
  }

  async updateTramiteEstado(
    id: string,
    from: TramiteEstado,
    estado: TramiteEstado,
    radicadoRef: string | null,
  ): Promise<TramiteRecord> {
    const row = await this.db
      .updateTable('emisora.tramite_externo')
      .set({ estado, radicado_ref: radicadoRef ?? undefined })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapTramite(row);
  }

  async createSoporteTramite(input: NewSoporteTramite): Promise<SoporteTramiteRecord> {
    const row = await this.db
      .insertInto('emisora.soporte_tramite')
      .values({
        id: input.id,
        tramite_id: input.tramiteId,
        archivo_id: input.archivoId,
        tipo: input.tipo,
        descripcion: input.descripcion,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapSoporte(row);
  }

  async listSoportesTramite(tramiteId: string): Promise<readonly SoporteTramiteRecord[]> {
    const rows = await this.db
      .selectFrom('emisora.soporte_tramite')
      .selectAll()
      .where('tramite_id', '=', tramiteId)
      .execute();
    return rows.map(mapSoporte);
  }

  async createPlanilla(input: NewPlanilla): Promise<PlanillaRecord> {
    try {
      const row = await this.db
        .insertInto('emisora.planilla_emision')
        .values({
          id: input.id,
          fecha: dateParam(input.fecha),
          programacion_diaria_id: input.programacionDiariaId,
          operador_id: input.operadorId,
          archivo_id: input.archivoId,
          estado: input.estado,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return mapPlanilla(row);
    } catch (error) {
      choqueUnico(error, 'planilla_emision_fecha_key', () => EmisoraError.planillaDuplicada());
    }
  }

  async findPlanillaByFecha(fecha: string): Promise<PlanillaRecord | null> {
    const row = await this.db
      .selectFrom('emisora.planilla_emision')
      .selectAll()
      .where('fecha', '=', dateParam(fecha))
      .executeTakeFirst();
    return row ? mapPlanilla(row) : null;
  }

  async findPlanillaById(id: string): Promise<PlanillaRecord | null> {
    const row = await this.db
      .selectFrom('emisora.planilla_emision')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapPlanilla(row) : null;
  }

  async updatePlanillaEstado(
    id: string,
    from: PlanillaEstado,
    estado: PlanillaEstado,
  ): Promise<PlanillaRecord> {
    const row = await this.db
      .updateTable('emisora.planilla_emision')
      .set({ estado })
      .where('id', '=', id)
      .where('estado', '=', from)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw EmisoraError.invalidTransition(from, estado);
    return mapPlanilla(row);
  }

  async createArchivoEmisora(input: NewArchivoEmisora): Promise<ArchivoEmisoraRecord> {
    try {
      const row = await this.db
        .insertInto('emisora.archivo_emisora')
        .values({
          id: input.id,
          archivo_id: input.archivoId,
          tipo: input.tipo,
          duracion_segundos: input.duracionSegundos,
          fecha: dateParam(input.fecha),
          responsable_id: input.responsableId,
          hash_sha256: input.hashSha256,
          mime: input.mime,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return mapArchivoEmisora(row);
    } catch (error) {
      choqueUnico(error, 'archivo_emisora_archivo_key', () =>
        EmisoraError.invalidInput('El archivo ya está registrado en la emisora.'),
      );
    }
  }

  async findArchivoEmisoraByArchivoId(archivoId: string): Promise<ArchivoEmisoraRecord | null> {
    const row = await this.db
      .selectFrom('emisora.archivo_emisora')
      .selectAll()
      .where('archivo_id', '=', archivoId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? mapArchivoEmisora(row) : null;
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

function mapResolucion(row: {
  id: string;
  incentivo_id: string;
  pdf_archivo_id: string;
  referencia_cdp: string;
  emitida_en: Date;
  creado_en: Date;
}): ResolucionRecord {
  return {
    id: row.id,
    incentivoId: row.incentivo_id,
    pdfArchivoId: row.pdf_archivo_id,
    referenciaCdp: row.referencia_cdp,
    emitidaEn: row.emitida_en,
    creadoEn: row.creado_en,
  };
}

function mapPatrocinio(row: {
  id: string;
  nombre: string;
  entidad: string;
  estado: PatrocinioRecord['estado'];
  fecha_inicio: Date | string | null;
  fecha_fin: Date | string | null;
  contrato_archivo_id: string | null;
}): PatrocinioRecord {
  return {
    id: row.id,
    nombre: row.nombre,
    entidad: row.entidad,
    estado: row.estado,
    fechaInicio: row.fecha_inicio ? fechaText(row.fecha_inicio) : null,
    fechaFin: row.fecha_fin ? fechaText(row.fecha_fin) : null,
    contratoArchivoId: row.contrato_archivo_id,
  };
}

function mapPromo(row: {
  id: string;
  patrocinio_id: string | null;
  nombre: string;
  guion: string | null;
  duracion_segundos: number;
  audio_archivo_id: string | null;
  estado: PromoRecord['estado'];
}): PromoRecord {
  return {
    id: row.id,
    patrocinioId: row.patrocinio_id,
    nombre: row.nombre,
    guion: row.guion,
    duracionSegundos: row.duracion_segundos,
    audioArchivoId: row.audio_archivo_id,
    estado: row.estado,
  };
}

function mapOrden(row: {
  id: string;
  promo_id: string;
  programacion_item_id: string | null;
  estado: OrdenEmisionRecord['estado'];
  fecha_emision: Date | string | null;
  emitida_en: Date | null;
}): OrdenEmisionRecord {
  return {
    id: row.id,
    promoId: row.promo_id,
    programacionItemId: row.programacion_item_id,
    estado: row.estado,
    fechaEmision: row.fecha_emision ? fechaText(row.fecha_emision) : null,
    emitidaEn: row.emitida_en,
  };
}

function mapPublicacion(row: {
  id: string;
  promo_id: string | null;
  canal: string;
  fecha_publicacion: Date | string;
  estado: PublicacionRecord['estado'];
  archivo_id: string | null;
  publicada_en: Date | null;
}): PublicacionRecord {
  return {
    id: row.id,
    promoId: row.promo_id,
    canal: row.canal,
    fechaPublicacion: fechaText(row.fecha_publicacion),
    estado: row.estado,
    archivoId: row.archivo_id,
    publicadaEn: row.publicada_en,
  };
}

function mapTransmision(row: {
  id: string;
  programacion_item_id: string | null;
  fecha_transmision: Date | string;
  es_fuera_ciudad: boolean;
  destino: string | null;
  estado: TransmisionRecord['estado'];
  autorizada_por: string | null;
  autorizada_en: Date | null;
}): TransmisionRecord {
  return {
    id: row.id,
    programacionItemId: row.programacion_item_id,
    fechaTransmision: fechaText(row.fecha_transmision),
    esFueraCiudad: row.es_fuera_ciudad,
    destino: row.destino,
    estado: row.estado,
    autorizadaPor: row.autorizada_por,
    autorizadaEn: row.autorizada_en,
  };
}

function mapSalida(row: {
  id: string;
  transmision_id: string;
  equipo_id: string;
  responsable_id: string;
  fecha_salida: Date;
  fecha_devolucion: Date | null;
  observaciones: string | null;
}): SalidaEquipoRecord {
  return {
    id: row.id,
    transmisionId: row.transmision_id,
    equipoId: row.equipo_id,
    responsableId: row.responsable_id,
    fechaSalida: row.fecha_salida,
    fechaDevolucion: row.fecha_devolucion,
    observaciones: row.observaciones,
  };
}

function mapReporte(row: {
  id: string;
  transmision_id: string;
  conductor_id: string | null;
  vehiculo: string;
  hora_salida: Date | null;
  hora_llegada: Date | null;
  novedades: string | null;
}): ReporteDesplazamientoRecord {
  return {
    id: row.id,
    transmisionId: row.transmision_id,
    conductorId: row.conductor_id,
    vehiculo: row.vehiculo,
    horaSalida: row.hora_salida,
    horaLlegada: row.hora_llegada,
    novedades: row.novedades,
  };
}

function mapPrestamo(row: {
  id: string;
  transmision_id: string;
  usuario_id: string;
  fecha_solicitud: Date;
  fecha_transmision: Date | string;
  estado: PrestamoMifiRecord['estado'];
  observaciones: string | null;
}): PrestamoMifiRecord {
  return {
    id: row.id,
    transmisionId: row.transmision_id,
    usuarioId: row.usuario_id,
    fechaSolicitud: row.fecha_solicitud,
    fechaTransmision: fechaText(row.fecha_transmision),
    estado: row.estado,
    observaciones: row.observaciones,
  };
}

function mapViatico(row: {
  id: string;
  transmision_id: string;
  usuario_id: string;
  estado: ViaticoRecord['estado'];
  referencia_compromiso: string | null;
  referencia_orden: string | null;
  soporte_archivo_id: string | null;
}): ViaticoRecord {
  return {
    id: row.id,
    transmisionId: row.transmision_id,
    usuarioId: row.usuario_id,
    estado: row.estado,
    referenciaCompromiso: row.referencia_compromiso,
    referenciaOrden: row.referencia_orden,
    soporteArchivoId: row.soporte_archivo_id,
  };
}

/* ------------------------------ Mapeadores E4 ---------------------------- */

type FilaFecha = Date | string;

function mapTransmisor(row: {
  id: string;
  codigo: string;
  nombre: string;
  sede: string;
  frecuencia: string | null;
  activo: boolean;
}): TransmisorRecord {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    sede: row.sede,
    frecuencia: row.frecuencia,
    activo: row.activo,
  };
}

function mapTurno(row: {
  id: string;
  transmisor_id: string;
  operador_id: string;
  fecha: FilaFecha;
  hora_inicio: string;
  hora_fin: string;
  estado: TurnoEstado;
}): TurnoRecord {
  return {
    id: row.id,
    transmisorId: row.transmisor_id,
    operadorId: row.operador_id,
    fecha: fechaText(row.fecha),
    horaInicio: row.hora_inicio,
    horaFin: row.hora_fin,
    estado: row.estado,
  };
}

function mapLectura(row: {
  id: string;
  transmisor_id: string;
  fecha: FilaFecha;
  potencia_w: number | null;
  frecuencia: string | null;
  observaciones: string | null;
  registrado_por: string;
}): LecturaRecord {
  return {
    id: row.id,
    transmisorId: row.transmisor_id,
    fecha: fechaText(row.fecha),
    potenciaW: row.potencia_w,
    frecuencia: row.frecuencia,
    observaciones: row.observaciones,
    registradoPor: row.registrado_por,
  };
}

function mapBitacora(row: {
  id: string;
  transmisor_id: string;
  turno_id: string | null;
  fecha: FilaFecha;
  incidente: string;
  accion: string | null;
  actor_id: string;
  request_id: string | null;
  ocurrido_en: Date;
}): BitacoraRecord {
  return {
    id: row.id,
    transmisorId: row.transmisor_id,
    turnoId: row.turno_id,
    fecha: fechaText(row.fecha),
    incidente: row.incidente,
    accion: row.accion,
    actorId: row.actor_id,
    requestId: row.request_id,
    ocurridoEn: row.ocurrido_en,
  };
}

function mapObra(row: {
  id: string;
  titulo: string;
  compositor_autor: string;
  duracion_segundos: number;
  fecha_inclusion: FilaFecha;
  archivo_id: string | null;
}): ObraRecord {
  return {
    id: row.id,
    titulo: row.titulo,
    compositorAutor: row.compositor_autor,
    duracionSegundos: row.duracion_segundos,
    fechaInclusion: fechaText(row.fecha_inclusion),
    archivoId: row.archivo_id,
  };
}

function mapReporteObra(row: {
  id: string;
  entidad: ReporteObraRecord['entidad'];
  periodo: string;
  fecha_inicio: FilaFecha;
  fecha_fin: FilaFecha;
  archivo_id: string | null;
  generado_en: Date;
}): ReporteObraRecord {
  return {
    id: row.id,
    entidad: row.entidad,
    periodo: row.periodo,
    fechaInicio: fechaText(row.fecha_inicio),
    fechaFin: fechaText(row.fecha_fin),
    archivoId: row.archivo_id,
    generadoEn: row.generado_en,
  };
}

function mapPago(row: {
  id: string;
  obra_id: string;
  reporte_id: string | null;
  soporte_archivo_id: string;
  referencia: string;
  estado: PagoDerechosRecord['estado'];
}): PagoDerechosRecord {
  return {
    id: row.id,
    obraId: row.obra_id,
    reporteId: row.reporte_id,
    soporteArchivoId: row.soporte_archivo_id,
    referencia: row.referencia,
    estado: row.estado,
  };
}

function mapEquipo(row: {
  id: string;
  nombre: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string;
  estado: EquipoEstado;
  fecha_adquisicion: FilaFecha | null;
  archivo_id: string | null;
}): EquipoRecord {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    marca: row.marca,
    modelo: row.modelo,
    numeroSerie: row.numero_serie,
    estado: row.estado,
    fechaAdquisicion: row.fecha_adquisicion ? fechaText(row.fecha_adquisicion) : null,
    archivoId: row.archivo_id,
  };
}

function mapActualizacion(row: {
  id: string;
  equipo_id: string;
  descripcion: string;
  solicitada_por: string | null;
  estado: ActualizacionEstado;
  fecha: FilaFecha | null;
  soporte_archivo_id: string | null;
}): ActualizacionRecord {
  return {
    id: row.id,
    equipoId: row.equipo_id,
    descripcion: row.descripcion,
    solicitadaPor: row.solicitada_por,
    estado: row.estado,
    fecha: row.fecha ? fechaText(row.fecha) : null,
    soporteArchivoId: row.soporte_archivo_id,
  };
}

function mapProyeccion(row: {
  id: string;
  anio: number;
  equipo_id: string | null;
  descripcion: string;
  estado: ProyeccionRecord['estado'];
  archivo_id: string | null;
}): ProyeccionRecord {
  return {
    id: row.id,
    anio: row.anio,
    equipoId: row.equipo_id,
    descripcion: row.descripcion,
    estado: row.estado,
    archivoId: row.archivo_id,
  };
}

function mapInversion(row: {
  id: string;
  proyeccion_id: string;
  contrato_ref: string | null;
  estado: InversionEstado;
  fecha_inicio: FilaFecha | null;
  fecha_fin: FilaFecha | null;
}): InversionRecord {
  return {
    id: row.id,
    proyeccionId: row.proyeccion_id,
    contratoRef: row.contrato_ref,
    estado: row.estado,
    fechaInicio: row.fecha_inicio ? fechaText(row.fecha_inicio) : null,
    fechaFin: row.fecha_fin ? fechaText(row.fecha_fin) : null,
  };
}

function mapVersionSoftware(row: {
  id: string;
  equipo_id: string | null;
  nombre: string;
  version: string;
  fecha_instalacion: FilaFecha;
  responsable_id: string | null;
}): VersionSoftwareRecord {
  return {
    id: row.id,
    equipoId: row.equipo_id,
    nombre: row.nombre,
    version: row.version,
    fechaInstalacion: fechaText(row.fecha_instalacion),
    responsableId: row.responsable_id,
  };
}

function mapAsignacion(row: {
  id: string;
  equipo_id: string;
  transmisor_id: string | null;
  usuario_id: string | null;
  fecha_asignacion: FilaFecha;
  fecha_devolucion: FilaFecha | null;
  estado: AsignacionEquipoRecord['estado'];
}): AsignacionEquipoRecord {
  return {
    id: row.id,
    equipoId: row.equipo_id,
    transmisorId: row.transmisor_id,
    usuarioId: row.usuario_id,
    fechaAsignacion: fechaText(row.fecha_asignacion),
    fechaDevolucion: row.fecha_devolucion ? fechaText(row.fecha_devolucion) : null,
    estado: row.estado,
  };
}

function mapActividad(row: {
  id: string;
  nombre: string;
  fecha: FilaFecha;
  lugar: string | null;
  descripcion: string | null;
  responsable_id: string | null;
  publicada: boolean;
  archivo_id: string | null;
}): ActividadCulturalRecord {
  return {
    id: row.id,
    nombre: row.nombre,
    fecha: fechaText(row.fecha),
    lugar: row.lugar,
    descripcion: row.descripcion,
    responsableId: row.responsable_id,
    publicada: row.publicada,
    archivoId: row.archivo_id,
  };
}

function mapPermiso(row: {
  id: string;
  actividad_id: string;
  oficio_archivo_id: string;
  destino: string | null;
  fecha_emision: FilaFecha | null;
  estado: PermisoEstado;
}): PermisoGobiernoRecord {
  return {
    id: row.id,
    actividadId: row.actividad_id,
    oficioArchivoId: row.oficio_archivo_id,
    destino: row.destino,
    fechaEmision: row.fecha_emision ? fechaText(row.fecha_emision) : null,
    estado: row.estado,
  };
}

function mapTramite(row: {
  id: string;
  destino: TramiteRecord['destino'];
  asunto: string;
  radicado_ref: string | null;
  estado: TramiteEstado;
  fecha_radicacion: FilaFecha;
  responsable_id: string | null;
}): TramiteRecord {
  return {
    id: row.id,
    destino: row.destino,
    asunto: row.asunto,
    radicadoRef: row.radicado_ref,
    estado: row.estado,
    fechaRadicacion: fechaText(row.fecha_radicacion),
    responsableId: row.responsable_id,
  };
}

function mapSoporte(row: {
  id: string;
  tramite_id: string;
  archivo_id: string;
  tipo: string | null;
  descripcion: string | null;
}): SoporteTramiteRecord {
  return {
    id: row.id,
    tramiteId: row.tramite_id,
    archivoId: row.archivo_id,
    tipo: row.tipo,
    descripcion: row.descripcion,
  };
}

function mapPlanilla(row: {
  id: string;
  fecha: FilaFecha;
  programacion_diaria_id: string | null;
  operador_id: string | null;
  archivo_id: string | null;
  estado: PlanillaEstado;
}): PlanillaRecord {
  return {
    id: row.id,
    fecha: fechaText(row.fecha),
    programacionDiariaId: row.programacion_diaria_id,
    operadorId: row.operador_id,
    archivoId: row.archivo_id,
    estado: row.estado,
  };
}

function mapArchivoEmisora(row: {
  id: string;
  archivo_id: string;
  tipo: ArchivoEmisoraRecord['tipo'];
  duracion_segundos: number | null;
  fecha: FilaFecha;
  responsable_id: string;
  hash_sha256: string | null;
  mime: string | null;
}): ArchivoEmisoraRecord {
  return {
    id: row.id,
    archivoId: row.archivo_id,
    tipo: row.tipo,
    duracionSegundos: row.duracion_segundos,
    fecha: fechaText(row.fecha),
    responsableId: row.responsable_id,
    hashSha256: row.hash_sha256,
    mime: row.mime,
  };
}
