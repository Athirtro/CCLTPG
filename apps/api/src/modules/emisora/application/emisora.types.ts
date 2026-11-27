import type {
  AsistenciaEstado,
  AudioTipo,
  ConvocatoriaEstado,
  FranjaTipo,
  GrabacionEstado,
  IncentivoEstado,
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
