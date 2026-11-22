import type {
  AsistenciaEstado,
  EvaluacionValor,
  GrupoEstado,
  MatriculaEstado,
  ProgramaArea,
  ProgramaEstado,
  SesionEstado,
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

/* -------------------------------------------------------------------------- */
/* Académico B (C5 — RB1-37)                                                    */
/* -------------------------------------------------------------------------- */

export interface SesionRecord {
  id: string;
  grupoId: string;
  fecha: Date;
  tema: string | null;
  estado: SesionEstado;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface NewSesionRecord {
  id: string;
  grupoId: string;
  fecha: Date;
  tema: string | null;
}

export interface SesionListFilter extends PageInput {
  grupoId: string;
}

export interface AsistenciaRecord {
  id: string;
  sesionId: string;
  matriculaId: string;
  estado: AsistenciaEstado;
  registradoPor: string;
  registradoEn: Date;
}

export interface NewAsistenciaRecord {
  id: string;
  sesionId: string;
  matriculaId: string;
  estado: AsistenciaEstado;
  registradoPor: string;
}

export interface IndicadorRecord {
  id: string;
  programaId: string | null;
  nombre: string;
  descripcion: string | null;
  escala: string;
  creadoEn: Date;
}

export interface EvaluacionRecord {
  id: string;
  matriculaId: string;
  indicadorId: string;
  periodo: string;
  valor: EvaluacionValor;
  observacion: string | null;
  evaluadoPor: string;
  evaluadoEn: Date;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface NewEvaluacionRecord {
  id: string;
  matriculaId: string;
  indicadorId: string;
  periodo: string;
  valor: EvaluacionValor;
  observacion: string | null;
  evaluadoPor: string;
}

export interface EvaluacionListFilter extends PageInput {
  grupoId: string | null;
  educadorId: string | null;
  estudianteUsuarioId: string | null;
}

export interface EvaluacionConIndicadorRecord extends EvaluacionRecord {
  indicadorNombre: string;
}

export interface MiEvaluacionRecord extends EvaluacionConIndicadorRecord {
  grupoCodigo: string;
  programaNombre: string;
}
