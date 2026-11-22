import type {
  GrupoEstado,
  MatriculaEstado,
  ProgramaArea,
  ProgramaEstado,
} from '../domain/academic-states.js';

export interface PageInput {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  page: number;
  pageSize: number;
  total: number;
  data: T[];
}

export interface ActorContext {
  userId: string;
  actorProfile: string | null;
  permissions: readonly string[];
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export interface ProgramaRecord {
  id: string;
  nombre: string;
  descripcion: string | null;
  area: ProgramaArea;
  cupoMaximo: number;
  estado: ProgramaEstado;
  creadoEn: Date;
}

export interface NewProgramaRecord {
  id: string;
  nombre: string;
  descripcion: string | null;
  area: ProgramaArea;
  cupoMaximo: number;
}

export interface GrupoRecord {
  id: string;
  programaId: string;
  codigo: string;
  educadorId: string;
  salon: string | null;
  periodo: string;
  cupoMaximo: number;
  estado: GrupoEstado;
  creadoEn: Date;
}

export interface NewGrupoRecord {
  id: string;
  programaId: string;
  codigo: string;
  educadorId: string;
  salon: string | null;
  periodo: string;
  cupoMaximo: number;
}

export interface HorarioRecord {
  id: string;
  grupoId: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export interface HorarioInput {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export interface HorarioConGrupoRecord extends HorarioRecord {
  grupoCodigo: string;
  programaNombre: string;
  salon: string | null;
  periodo: string;
}

export interface EstudianteRecord {
  id: string;
  usuarioId: string | null;
  tipoDocumento: string;
  numeroDocumentoCifrado: string;
  numeroDocumentoHash: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: Date | null;
  municipio: string | null;
  barrio: string | null;
  direccionCifrada: string | null;
  telefonoCifrado: string | null;
  acudiente: unknown;
  consentimientoDatos: unknown;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface NewEstudianteRecord {
  id: string;
  usuarioId: string | null;
  tipoDocumento: string;
  numeroDocumentoCifrado: string;
  numeroDocumentoHash: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: Date | null;
  municipio: string | null;
  barrio: string | null;
  direccionCifrada: string | null;
  telefonoCifrado: string | null;
  acudiente: unknown;
  consentimientoDatos: unknown;
}

export interface UpdateEstudianteRecord {
  usuarioId: string | null;
  tipoDocumento: string;
  numeroDocumentoCifrado: string;
  numeroDocumentoHash: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: Date | null;
  municipio: string | null;
  barrio: string | null;
  direccionCifrada: string | null;
  telefonoCifrado: string | null;
  acudiente: unknown;
  consentimientoDatos: unknown;
}

export interface MatriculaRecord {
  id: string;
  estudianteId: string;
  grupoId: string;
  estado: MatriculaEstado;
  fechaMatricula: Date;
  periodo: string;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface NewMatriculaRecord {
  id: string;
  estudianteId: string;
  grupoId: string;
  periodo: string;
  fechaMatricula: Date;
}

export interface MatriculaListRecord extends MatriculaRecord {
  estudianteNombres: string;
  estudianteApellidos: string;
  grupoCodigo: string;
  programaId: string;
  programaNombre: string;
}

export interface ConsentimientoDatos {
  aceptado: boolean;
  fecha: string;
  versionAviso: string;
  medio?: string;
}
