import type {
  AsistenciaEstado,
  EvaluacionValor,
  GrupoEstado,
  MatriculaEstado,
  ProgramaArea,
  ProgramaEstado,
  SesionEstado,
} from '../domain/academic-states.js';

/**
 * Representaciones de salida de la capa de aplicación. Los controladores las
 * convierten en DTOs; los listados nunca incluyen documento, dirección ni
 * teléfono (AC-SEC-25).
 */

export interface ProgramaView {
  id: string;
  nombre: string;
  descripcion: string | null;
  area: ProgramaArea;
  cupoMaximo: number;
  estado: ProgramaEstado;
  creadoEn: string;
}

export interface GrupoView {
  id: string;
  programaId: string;
  codigo: string;
  educadorId: string;
  salon: string | null;
  periodo: string;
  cupoMaximo: number;
  estado: GrupoEstado;
  creadoEn: string;
}

export interface HorarioView {
  id: string;
  grupoId: string;
  grupoCodigo: string | null;
  programaNombre: string | null;
  salon: string | null;
  periodo: string | null;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export interface EstudianteSummaryView {
  id: string;
  usuarioId: string | null;
  tipoDocumento: string;
  nombres: string;
  apellidos: string;
  municipio: string | null;
  barrio: string | null;
  consentimientoAceptado: boolean;
  creadoEn: string;
}

export interface EstudianteDetailView extends EstudianteSummaryView {
  numeroDocumento: string;
  fechaNacimiento: string | null;
  direccion: string | null;
  telefono: string | null;
  consentimientoDatos: unknown;
  actualizadoEn: string;
}

export interface MatriculaView {
  id: string;
  estudianteId: string;
  estudianteNombres: string;
  estudianteApellidos: string;
  grupoId: string;
  grupoCodigo: string;
  programaId: string;
  programaNombre: string;
  periodo: string;
  estado: MatriculaEstado;
  fechaMatricula: string;
}

export interface SesionView {
  id: string;
  grupoId: string;
  fecha: string;
  tema: string | null;
  estado: SesionEstado;
  creadoEn: string;
}

export interface AsistenciaView {
  id: string;
  sesionId: string;
  matriculaId: string;
  estado: AsistenciaEstado;
  registradoEn: string;
}

export interface IndicadorView {
  id: string;
  programaId: string | null;
  nombre: string;
  descripcion: string | null;
  escala: string;
}

export interface EvaluacionView {
  id: string;
  matriculaId: string;
  indicadorId: string;
  indicadorNombre: string;
  periodo: string;
  valor: EvaluacionValor;
  observacion: string | null;
  evaluadoEn: string;
}

export interface MiEvaluacionView extends EvaluacionView {
  grupoCodigo: string;
  programaNombre: string;
}
