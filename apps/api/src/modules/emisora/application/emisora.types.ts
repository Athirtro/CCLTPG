import type {
  AsistenciaEstado,
  AudioTipo,
  ConvocatoriaEstado,
  FranjaTipo,
  GrabacionEstado,
  IncentivoEstado,
  OrdenEmisionEstado,
  PatrocinioEstado,
  PrestamoEstado,
  PromoEstado,
  PublicacionEstado,
  TransmisionEstado,
  ViaticoEstado,
  ProgramacionEstado,
  ProyectoEstado,
  RejillaEstado,
} from '../domain/emisora-states.js';

/** Contexto de actor reutilizado por auditoría y outbox (ADR-0004/0005). */
export interface ActorContext {
  userId: string;
  actorProfile: string | null;
  permissions: readonly string[];
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export interface ConvocatoriaRecord {
  id: string;
  anio: number;
  fechaApertura: string;
  fechaCierre: string;
  estado: ConvocatoriaEstado;
  basesArchivoId: string | null;
  creadoEn: Date;
}

export interface RealizadorRecord {
  id: string;
  usuarioId: string | null;
  nombres: string;
  apellidos: string;
  municipio: string | null;
  creadoEn: Date;
}

export interface ProyectoRecord {
  id: string;
  convocatoriaId: string;
  realizadorId: string;
  titulo: string;
  archivoId: string;
  fechaRecepcion: string;
  estado: ProyectoEstado;
  creadoEn: Date;
}

export interface ComiteRecord {
  id: string;
  convocatoriaId: string;
  fecha: string;
  actaArchivoId: string | null;
  integrantes: readonly string[];
  conclusiones: string | null;
}

export interface RejillaItemRecord {
  id: string;
  rejillaAnualId: string;
  fecha: string | null;
  diaSemana: number | null;
  horaInicio: string;
  horaFin: string;
  tipo: FranjaTipo;
  programaId: string | null;
  nombre: string;
}

export interface RejillaRecord {
  id: string;
  anio: number;
  comiteId: string | null;
  estado: RejillaEstado;
  aprobadaEn: Date | null;
  creadoEn: Date;
}

export interface ProgramacionItemRecord {
  id: string;
  programacionDiariaId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tipo: FranjaTipo;
  programaId: string | null;
  titulo: string;
}

export interface ProgramacionRecord {
  id: string;
  rejillaAnualId: string;
  fecha: string;
  estado: ProgramacionEstado;
  concuerda: boolean | null;
  desviaciones: string[];
  responsableId: string | null;
  creadoEn: Date;
}

export interface GrabacionRecord {
  id: string;
  programacionItemId: string | null;
  fecha: string;
  estado: GrabacionEstado;
  responsableId: string | null;
  aprobadaPor: string | null;
  creadoEn: Date;
}

export interface AsistenciaRecord {
  sesionId: string;
  usuarioId: string;
  estado: AsistenciaEstado;
  registradoEn: Date;
}

export interface AudioRecord {
  id: string;
  sesionGrabacionId: string;
  tipo: AudioTipo;
  duracionSegundos: number;
  fecha: string;
  responsableId: string;
  archivoId: string;
  hashSha256: string | null;
  creadoEn: Date;
}

export interface InformeRecord {
  id: string;
  proyectoId: string;
  realizadorId: string;
  fechaInforme: string;
  estado: 'recibido' | 'evaluado';
  archivoId: string;
  creadoEn: Date;
}

export interface IncentivoRecord {
  id: string;
  informeId: string;
  comiteId: string | null;
  realizadorId: string;
  estado: IncentivoEstado;
  calificacion: number | null;
  referenciaCdp: string | null;
  creadoEn: Date;
}

/* ------------------------------ Vistas API ------------------------------- */

export interface ConvocatoriaView {
  id: string;
  anio: number;
  fechaApertura: string;
  fechaCierre: string;
  estado: ConvocatoriaEstado;
}

export interface RejillaView {
  id: string;
  anio: number;
  estado: RejillaEstado;
  aprobadaEn: string | null;
  items: RejillaItemRecord[];
}

export interface ProgramacionView {
  id: string;
  rejillaAnualId: string;
  fecha: string;
  estado: ProgramacionEstado;
  concuerda: boolean | null;
  desviaciones: string[];
  items: ProgramacionItemRecord[];
}

export interface GrabacionView {
  id: string;
  programacionItemId: string | null;
  fecha: string;
  estado: GrabacionEstado;
  responsableId: string | null;
}

export interface AsistenciaView {
  sesionId: string;
  usuarioId: string;
  estado: AsistenciaEstado;
  registradoEn: string;
}

export interface AudioView {
  id: string;
  sesionGrabacionId: string;
  tipo: AudioTipo;
  duracionSegundos: number;
  fecha: string;
  archivoId: string;
  hashSha256: string | null;
  archivo: {
    nombreOriginal: string;
    mime: string;
    tamano: number;
    estadoEscaneo: string;
  };
}

export interface InformeView {
  id: string;
  proyectoId: string;
  realizadorId: string;
  fechaInforme: string;
  estado: 'recibido' | 'evaluado';
  archivoId: string;
}

export interface IncentivoView {
  id: string;
  informeId: string;
  realizadorId: string;
  estado: IncentivoEstado;
  calificacion: number | null;
  referenciaCdp: string | null;
}

/* ------------------------------- Registros E3 ----------------------------- */

export interface ResolucionRecord {
  id: string;
  incentivoId: string;
  pdfArchivoId: string;
  referenciaCdp: string;
  emitidaEn: Date;
  creadoEn: Date;
}

export interface PatrocinioRecord {
  id: string;
  nombre: string;
  entidad: string;
  estado: PatrocinioEstado;
  fechaInicio: string | null;
  fechaFin: string | null;
  contratoArchivoId: string | null;
}

export interface PromoRecord {
  id: string;
  patrocinioId: string | null;
  nombre: string;
  guion: string | null;
  duracionSegundos: number;
  audioArchivoId: string | null;
  estado: PromoEstado;
}

export interface OrdenEmisionRecord {
  id: string;
  promoId: string;
  programacionItemId: string | null;
  estado: OrdenEmisionEstado;
  fechaEmision: string | null;
  emitidaEn: Date | null;
}

export interface PublicacionRecord {
  id: string;
  promoId: string | null;
  canal: string;
  fechaPublicacion: string;
  estado: PublicacionEstado;
  archivoId: string | null;
  publicadaEn: Date | null;
}

export interface TransmisionRecord {
  id: string;
  programacionItemId: string | null;
  fechaTransmision: string;
  esFueraCiudad: boolean;
  destino: string | null;
  estado: TransmisionEstado;
  autorizadaPor: string | null;
  autorizadaEn: Date | null;
}

export interface SalidaEquipoRecord {
  id: string;
  transmisionId: string;
  equipoId: string;
  responsableId: string;
  fechaSalida: Date;
  fechaDevolucion: Date | null;
  observaciones: string | null;
}

export interface ReporteDesplazamientoRecord {
  id: string;
  transmisionId: string;
  conductorId: string | null;
  vehiculo: string;
  horaSalida: Date | null;
  horaLlegada: Date | null;
  novedades: string | null;
}

export interface PrestamoMifiRecord {
  id: string;
  transmisionId: string;
  usuarioId: string;
  fechaSolicitud: Date;
  fechaTransmision: string;
  estado: PrestamoEstado;
  observaciones: string | null;
}

export interface ViaticoRecord {
  id: string;
  transmisionId: string;
  usuarioId: string;
  estado: ViaticoEstado;
  referenciaCompromiso: string | null;
  referenciaOrden: string | null;
  soporteArchivoId: string | null;
}

/* -------------------------------- Vistas E3 ------------------------------- */

export interface ResolucionView {
  id: string;
  incentivoId: string;
  archivoId: string;
  referenciaCdp: string;
  emitidaEn: string;
  descargaUrl: string;
}

export interface PatrocinioView {
  id: string;
  nombre: string;
  entidad: string;
  estado: PatrocinioRecord['estado'];
  fechaInicio: string | null;
  fechaFin: string | null;
  contratoArchivoId: string | null;
}

export interface PromoView {
  id: string;
  patrocinioId: string | null;
  nombre: string;
  duracionSegundos: number;
  audioArchivoId: string | null;
  estado: PromoRecord['estado'];
}

export interface OrdenEmisionView {
  id: string;
  promoId: string;
  programacionItemId: string | null;
  estado: OrdenEmisionRecord['estado'];
  fechaEmision: string | null;
  emitidaEn: string | null;
}

export interface PublicacionView {
  id: string;
  promoId: string | null;
  canal: string;
  fechaPublicacion: string;
  estado: PublicacionRecord['estado'];
  archivoId: string | null;
  publicadaEn: string | null;
}

export interface TransmisionView {
  id: string;
  programacionItemId: string | null;
  fechaTransmision: string;
  esFueraCiudad: boolean;
  destino: string | null;
  estado: TransmisionRecord['estado'];
  autorizadaEn: string | null;
}

export interface SalidaEquipoView {
  id: string;
  transmisionId: string;
  equipoId: string;
  responsableId: string;
  fechaSalida: string;
  fechaDevolucion: string | null;
}

export interface ReporteDesplazamientoView {
  id: string;
  transmisionId: string;
  conductorId: string | null;
  vehiculo: string;
  horaSalida: string | null;
  horaLlegada: string | null;
  novedades: string | null;
}

export interface PrestamoMifiView {
  id: string;
  transmisionId: string;
  usuarioId: string;
  fechaSolicitud: string;
  fechaTransmision: string;
  estado: PrestamoMifiRecord['estado'];
}

export interface ViaticoView {
  id: string;
  transmisionId: string;
  usuarioId: string;
  estado: ViaticoRecord['estado'];
  referenciaCompromiso: string | null;
  referenciaOrden: string | null;
  soporteArchivoId: string | null;
}
