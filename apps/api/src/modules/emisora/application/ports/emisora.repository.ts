export const EMISORA_REPOSITORY = Symbol('CCLTPG_EMISORA_REPOSITORY');

import type {
  AsistenciaEstado,
  AudioTipo,
  FranjaTipo,
  GrabacionEstado,
  IncentivoEstado,
} from '../../domain/emisora-states.js';
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

/**
 * Repositorio de los agregados E2 de la emisora. Todas las escrituras reciben
 * el ejecutor transaccional del `EmisoraUnitOfWork`; nunca abren transacción.
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
}
