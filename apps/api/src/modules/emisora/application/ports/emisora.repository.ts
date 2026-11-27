export const EMISORA_REPOSITORY = Symbol('CCLTPG_EMISORA_REPOSITORY');

import type {
  ActualizacionEstado,
  ArchivoEmisoraTipo,
  AsistenciaEstado,
  AudioTipo,
  EquipoEstado,
  FranjaTipo,
  GrabacionEstado,
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
  TramiteDestino,
  TramiteEstado,
  TransmisionEstado,
  TurnoEstado,
} from '../../domain/emisora-states.js';
import type { EntidadReporte } from '../../domain/emisora-states.js';
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
} from '../emisora.types.js';

export interface NewConvocatoria {
  id: string;
  anio: number;
  fechaApertura: string;
  fechaCierre: string;
  basesArchivoId: string | null;
}

export interface NewRealizador {
  id: string;
  usuarioId: string | null;
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumentoCifrado: string;
  numeroDocumentoHash: string;
  contactoCifrado: string | null;
  municipio: string | null;
  fechaNacimiento: string | null;
  consentimientoDatos: Record<string, unknown>;
}

export interface NewProyecto {
  id: string;
  convocatoriaId: string;
  realizadorId: string;
  programaId: string | null;
  formadorId: string | null;
  titulo: string;
  archivoId: string;
  fechaRecepcion: string;
  observaciones: string | null;
}

export interface NewComite {
  id: string;
  convocatoriaId: string;
  fecha: string;
  actaArchivoId: string;
  integrantes: readonly string[];
  conclusiones: string | null;
}

export interface NewProgramacionItem {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tipo: FranjaTipo;
  programaId: string | null;
  titulo: string;
}

export interface NewProgramacion {
  id: string;
  rejillaAnualId: string;
  fecha: string;
  concuerda: boolean;
  desviaciones: readonly string[];
  responsableId: string;
  items: readonly NewProgramacionItem[];
}

export interface NewGrabacion {
  id: string;
  programacionItemId: string | null;
  fecha: string;
  responsableId: string | null;
}

export interface NewAsistencia {
  usuarioId: string;
  estado: AsistenciaEstado;
}

export interface NewAudio {
  id: string;
  sesionGrabacionId: string;
  tipo: AudioTipo;
  duracionSegundos: number;
  fecha: string;
  responsableId: string;
  archivoId: string;
  hashSha256: string | null;
}

export interface NewInforme {
  id: string;
  proyectoId: string;
  realizadorId: string;
  fechaInforme: string;
  archivoId: string;
  observaciones: string | null;
}

export interface NewResolucion {
  id: string;
  incentivoId: string;
  pdfArchivoId: string;
  referenciaCdp: string;
}

export interface NewPatrocinio {
  id: string;
  nombre: string;
  entidad: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  contratoArchivoId: string | null;
}

export interface NewPromo {
  id: string;
  patrocinioId: string | null;
  nombre: string;
  guion: string | null;
  duracionSegundos: number;
  audioArchivoId: string | null;
}

export interface NewOrdenEmision {
  id: string;
  promoId: string;
  programacionItemId: string | null;
  fechaEmision: string | null;
}

export interface NewPublicacion {
  id: string;
  promoId: string | null;
  canal: string;
  fechaPublicacion: string;
  archivoId: string | null;
}

export interface NewTransmision {
  id: string;
  programacionItemId: string | null;
  fechaTransmision: string;
  esFueraCiudad: boolean;
  destino: string | null;
}

export interface NewSalidaEquipo {
  id: string;
  transmisionId: string;
  equipoId: string;
  responsableId: string;
  fechaSalida: Date;
  observaciones: string | null;
}

export interface NewReporteDesplazamiento {
  id: string;
  transmisionId: string;
  conductorId: string | null;
  vehiculo: string;
  horaSalida: Date | null;
  horaLlegada: Date | null;
  novedades: string | null;
}

export interface NewPrestamoMifi {
  id: string;
  transmisionId: string;
  usuarioId: string;
  fechaSolicitud: Date;
  fechaTransmision: string;
  observaciones: string | null;
}

export interface NewViatico {
  id: string;
  transmisionId: string;
  usuarioId: string;
  soporteArchivoId: string | null;
}

/* --------------------------------- E4 ------------------------------------ */

export interface NewTurno {
  id: string;
  transmisorId: string;
  operadorId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export interface NewLectura {
  id: string;
  transmisorId: string;
  fecha: string;
  potenciaW: number | null;
  frecuencia: string | null;
  observaciones: string | null;
  registradoPor: string;
}

export interface NewBitacora {
  id: string;
  transmisorId: string;
  turnoId: string | null;
  fecha: string;
  incidente: string;
  accion: string | null;
  actorId: string;
  requestId: string | null;
}

export interface NewObra {
  id: string;
  titulo: string;
  compositorAutor: string;
  duracionSegundos: number;
  fechaInclusion: string;
  archivoId: string | null;
}

export interface NewReporteObra {
  id: string;
  entidad: EntidadReporte;
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  archivoId: string;
}

export interface NewPagoDerechos {
  id: string;
  obraId: string;
  reporteId: string | null;
  soporteArchivoId: string;
  referencia: string;
}

export interface NewEquipo {
  id: string;
  nombre: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string;
  fechaAdquisicion: string | null;
  archivoId: string | null;
}

export interface NewActualizacion {
  id: string;
  equipoId: string;
  descripcion: string;
  solicitadaPor: string | null;
  fecha: string | null;
  soporteArchivoId: string | null;
}

export interface NewProyeccion {
  id: string;
  anio: number;
  equipoId: string | null;
  descripcion: string;
  archivoId: string | null;
}

export interface NewInversion {
  id: string;
  proyeccionId: string;
  contratoRef: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export interface NewVersionSoftware {
  id: string;
  equipoId: string | null;
  nombre: string;
  version: string;
  fechaInstalacion: string;
  responsableId: string | null;
}

export interface NewAsignacionEquipo {
  id: string;
  equipoId: string;
  transmisorId: string | null;
  usuarioId: string | null;
  fechaAsignacion: string;
  fechaDevolucion: string | null;
}

export interface NewActividadCultural {
  id: string;
  nombre: string;
  fecha: string;
  lugar: string | null;
  descripcion: string | null;
  responsableId: string | null;
  archivoId: string | null;
}

export interface NewPermisoGobierno {
  id: string;
  actividadId: string;
  oficioArchivoId: string;
  destino: string | null;
  fechaEmision: string | null;
}

export interface NewTramite {
  id: string;
  destino: TramiteDestino;
  asunto: string;
  radicadoRef: string | null;
  fechaRadicacion: string;
  responsableId: string | null;
}

export interface NewSoporteTramite {
  id: string;
  tramiteId: string;
  archivoId: string;
  tipo: string | null;
  descripcion: string | null;
}

export interface NewPlanilla {
  id: string;
  fecha: string;
  programacionDiariaId: string | null;
  operadorId: string | null;
  archivoId: string;
}

export interface NewArchivoEmisora {
  id: string;
  archivoId: string;
  tipo: ArchivoEmisoraTipo;
  duracionSegundos: number | null;
  fecha: string;
  responsableId: string;
  hashSha256: string | null;
  mime: string;
}

/**
 * Repositorio de los agregados de la emisora (E2, E3 y E4). Todas las escrituras
 * reciben el ejecutor transaccional del `EmisoraUnitOfWork`; nunca abren
 * transacción. Las transiciones filtran por el estado de origen.
 */
export interface EmisoraRepository {
  createConvocatoria(input: NewConvocatoria): Promise<ConvocatoriaRecord>;
  findConvocatoriaById(id: string): Promise<ConvocatoriaRecord | null>;
  findConvocatoriaByAnio(anio: number): Promise<ConvocatoriaRecord | null>;
  listConvocatorias(): Promise<readonly ConvocatoriaRecord[]>;

  createRealizador(input: NewRealizador): Promise<RealizadorRecord>;
  findRealizadorById(id: string): Promise<RealizadorRecord | null>;
  updateRealizadorContacto(
    id: string,
    contactoCifrado: string | null,
    municipio: string | null,
  ): Promise<RealizadorRecord>;

  createProyecto(input: NewProyecto): Promise<ProyectoRecord>;
  findProyectoById(id: string): Promise<ProyectoRecord | null>;

  createComite(input: NewComite): Promise<ComiteRecord>;
  findComiteById(id: string): Promise<ComiteRecord | null>;

  findRejillaByAnio(anio: number): Promise<RejillaRecord | null>;
  findRejillaById(id: string): Promise<RejillaRecord | null>;
  vincularComiteRejilla(rejillaId: string, comiteId: string): Promise<void>;
  listRejillaItems(rejillaId: string): Promise<readonly RejillaItemRecord[]>;
  updateRejillaEstado(id: string, comiteId: string, aprobadaEn: Date): Promise<RejillaRecord>;

  createProgramacion(input: NewProgramacion): Promise<ProgramacionRecord>;
  findProgramacionById(id: string): Promise<ProgramacionRecord | null>;
  findProgramacionByFecha(fecha: string): Promise<ProgramacionRecord | null>;
  listProgramacionItems(programacionId: string): Promise<readonly ProgramacionItemRecord[]>;
  findProgramacionItemById(id: string): Promise<ProgramacionItemRecord | null>;
  updateProgramacionEstado(
    id: string,
    estado: 'borrador' | 'aprobada',
    responsableId: string,
  ): Promise<ProgramacionRecord>;

  createGrabacion(input: NewGrabacion): Promise<GrabacionRecord>;
  findGrabacionById(id: string): Promise<GrabacionRecord | null>;
  listGrabaciones(): Promise<readonly GrabacionRecord[]>;
  updateGrabacionEstado(
    id: string,
    from: GrabacionEstado,
    estado: GrabacionEstado,
    aprobadaPor: string,
  ): Promise<GrabacionRecord>;

  replaceAsistencia(
    sesionId: string,
    entries: readonly NewAsistencia[],
  ): Promise<AsistenciaRecord[]>;
  listAsistencia(sesionId: string): Promise<readonly AsistenciaRecord[]>;

  createAudio(input: NewAudio): Promise<AudioRecord>;
  findAudioById(id: string): Promise<AudioRecord | null>;
  listAudio(sesionId: string | null): Promise<readonly AudioRecord[]>;

  createInforme(input: NewInforme): Promise<InformeRecord>;
  findInformeById(id: string): Promise<InformeRecord | null>;
  createIncentivo(input: {
    id: string;
    informeId: string;
    comiteId: string | null;
    realizadorId: string;
  }): Promise<IncentivoRecord>;
  findIncentivoById(id: string): Promise<IncentivoRecord | null>;
  updateIncentivo(
    id: string,
    from: IncentivoEstado,
    estado: IncentivoEstado,
    calificacion: number | null,
    referenciaCdp: string | null,
  ): Promise<IncentivoRecord>;
  listIncentivos(): Promise<readonly IncentivoRecord[]>;

  createResolucion(input: NewResolucion): Promise<ResolucionRecord>;
  findResolucionById(id: string): Promise<ResolucionRecord | null>;
  findResolucionByIncentivoId(incentivoId: string): Promise<ResolucionRecord | null>;

  createPatrocinio(input: NewPatrocinio): Promise<PatrocinioRecord>;
  findPatrocinioById(id: string): Promise<PatrocinioRecord | null>;
  updatePatrocinioEstado(
    id: string,
    from: PatrocinioEstado,
    estado: PatrocinioEstado,
    contratoArchivoId: string | null,
  ): Promise<PatrocinioRecord>;

  createPromo(input: NewPromo): Promise<PromoRecord>;
  findPromoById(id: string): Promise<PromoRecord | null>;
  updatePromoEstado(
    id: string,
    from: PromoEstado,
    estado: PromoEstado,
    audioArchivoId: string | null,
  ): Promise<PromoRecord>;

  createOrden(input: NewOrdenEmision): Promise<OrdenEmisionRecord>;
  findOrdenById(id: string): Promise<OrdenEmisionRecord | null>;
  updateOrdenEstado(
    id: string,
    from: OrdenEmisionEstado,
    estado: OrdenEmisionEstado,
    emitidaEn: Date | null,
  ): Promise<OrdenEmisionRecord>;

  createPublicacion(input: NewPublicacion): Promise<PublicacionRecord>;
  findPublicacionById(id: string): Promise<PublicacionRecord | null>;
  updatePublicacionEstado(
    id: string,
    from: PublicacionEstado,
    estado: PublicacionEstado,
    publicadaEn: Date | null,
    archivoId: string | null,
  ): Promise<PublicacionRecord>;

  createTransmision(input: NewTransmision): Promise<TransmisionRecord>;
  findTransmisionById(id: string): Promise<TransmisionRecord | null>;
  updateTransmisionEstado(
    id: string,
    from: TransmisionEstado,
    estado: TransmisionEstado,
    autorizadaPor: string | null,
    autorizadaEn: Date | null,
  ): Promise<TransmisionRecord>;

  createSalidaEquipo(input: NewSalidaEquipo): Promise<SalidaEquipoRecord>;
  findSalidaEquipoByTransmision(transmisionId: string): Promise<readonly SalidaEquipoRecord[]>;
  devolverSalidaEquipo(id: string, fechaDevolucion: Date): Promise<SalidaEquipoRecord>;

  createReporteDesplazamiento(
    input: NewReporteDesplazamiento,
  ): Promise<ReporteDesplazamientoRecord>;
  findReporteDesplazamientoByTransmision(
    transmisionId: string,
  ): Promise<ReporteDesplazamientoRecord | null>;

  createPrestamoMifi(input: NewPrestamoMifi): Promise<PrestamoMifiRecord>;
  findPrestamoMifiById(id: string): Promise<PrestamoMifiRecord | null>;
  updatePrestamoMifiEstado(
    id: string,
    from: PrestamoEstado,
    estado: PrestamoEstado,
  ): Promise<PrestamoMifiRecord>;

  createViatico(input: NewViatico): Promise<ViaticoRecord>;
  findViaticoById(id: string): Promise<ViaticoRecord | null>;

  findTransmisorById(id: string): Promise<TransmisorRecord | null>;

  createTurno(input: NewTurno): Promise<TurnoRecord>;
  findTurnoById(id: string): Promise<TurnoRecord | null>;
  updateTurnoEstado(id: string, from: TurnoEstado, estado: TurnoEstado): Promise<TurnoRecord>;

  createLectura(input: NewLectura): Promise<LecturaRecord>;
  findLecturaByTransmisorFecha(transmisorId: string, fecha: string): Promise<LecturaRecord | null>;
  listLecturas(transmisorId: string | null): Promise<readonly LecturaRecord[]>;

  createBitacora(input: NewBitacora): Promise<BitacoraRecord>;

  createObra(input: NewObra): Promise<ObraRecord>;
  findObraById(id: string): Promise<ObraRecord | null>;
  listObras(): Promise<readonly ObraRecord[]>;

  createReporteObra(input: NewReporteObra): Promise<ReporteObraRecord>;
  createPagoDerechos(input: NewPagoDerechos): Promise<PagoDerechosRecord>;
  findPagoDerechosById(id: string): Promise<PagoDerechosRecord | null>;

  createEquipo(input: NewEquipo): Promise<EquipoRecord>;
  findEquipoById(id: string): Promise<EquipoRecord | null>;
  updateEquipoEstado(id: string, estado: EquipoEstado): Promise<EquipoRecord>;

  createActualizacion(input: NewActualizacion): Promise<ActualizacionRecord>;
  findActualizacionById(id: string): Promise<ActualizacionRecord | null>;
  updateActualizacionEstado(
    id: string,
    from: ActualizacionEstado,
    estado: ActualizacionEstado,
  ): Promise<ActualizacionRecord>;

  createProyeccion(input: NewProyeccion): Promise<ProyeccionRecord>;
  findProyeccionById(id: string): Promise<ProyeccionRecord | null>;
  findProyeccionByAnio(anio: number): Promise<ProyeccionRecord | null>;
  updateProyeccionEstado(
    id: string,
    from: ProyeccionEstado,
    estado: ProyeccionEstado,
  ): Promise<ProyeccionRecord>;

  createInversion(input: NewInversion): Promise<InversionRecord>;
  findInversionById(id: string): Promise<InversionRecord | null>;
  updateInversionEstado(
    id: string,
    from: InversionEstado,
    estado: InversionEstado,
    contratoRef: string | null,
  ): Promise<InversionRecord>;

  createVersionSoftware(input: NewVersionSoftware): Promise<VersionSoftwareRecord>;
  createAsignacionEquipo(input: NewAsignacionEquipo): Promise<AsignacionEquipoRecord>;

  createActividad(input: NewActividadCultural): Promise<ActividadCulturalRecord>;
  findActividadById(id: string): Promise<ActividadCulturalRecord | null>;
  listActividades(): Promise<readonly ActividadCulturalRecord[]>;

  createPermisoGobierno(input: NewPermisoGobierno): Promise<PermisoGobiernoRecord>;
  findPermisoGobiernoById(id: string): Promise<PermisoGobiernoRecord | null>;
  updatePermisoEstado(
    id: string,
    from: PermisoEstado,
    estado: PermisoEstado,
  ): Promise<PermisoGobiernoRecord>;

  createTramite(input: NewTramite): Promise<TramiteRecord>;
  findTramiteById(id: string): Promise<TramiteRecord | null>;
  listTramites(): Promise<readonly TramiteRecord[]>;
  updateTramiteEstado(
    id: string,
    from: TramiteEstado,
    estado: TramiteEstado,
    radicadoRef: string | null,
  ): Promise<TramiteRecord>;

  createSoporteTramite(input: NewSoporteTramite): Promise<SoporteTramiteRecord>;
  listSoportesTramite(tramiteId: string): Promise<readonly SoporteTramiteRecord[]>;

  createPlanilla(input: NewPlanilla): Promise<PlanillaRecord>;
  findPlanillaByFecha(fecha: string): Promise<PlanillaRecord | null>;
  findPlanillaById(id: string): Promise<PlanillaRecord | null>;
  updatePlanillaEstado(
    id: string,
    from: PlanillaEstado,
    estado: PlanillaEstado,
  ): Promise<PlanillaRecord>;

  createArchivoEmisora(input: NewArchivoEmisora): Promise<ArchivoEmisoraRecord>;
  findArchivoEmisoraByArchivoId(archivoId: string): Promise<ArchivoEmisoraRecord | null>;
}
