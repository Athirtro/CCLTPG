import type {
  GrupoEstado,
  MatriculaEstado,
  ProgramaArea,
  ProgramaEstado,
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
