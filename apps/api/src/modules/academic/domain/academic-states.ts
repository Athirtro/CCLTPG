/**
 * Máquinas de estado y reglas puras del dominio académico (D64).
 * Sin dependencias de framework: la capa de aplicación las usa y la
 * infraestructura solo persiste el resultado.
 */

export const PROGRAM_AREAS = ['danza', 'musica', 'teatro', 'artes_plasticas'] as const;
export type ProgramaArea = (typeof PROGRAM_AREAS)[number];

export const PROGRAMA_ESTADOS = ['borrador', 'publicado', 'archivado'] as const;
export type ProgramaEstado = (typeof PROGRAMA_ESTADOS)[number];

export const GRUPO_ESTADOS = ['abierto', 'cerrado'] as const;
export type GrupoEstado = (typeof GRUPO_ESTADOS)[number];

export const MATRICULA_ESTADOS = [
  'preinscrita',
  'confirmada',
  'activa',
  'finalizada',
  'cancelada',
  'retirada',
] as const;
export type MatriculaEstado = (typeof MATRICULA_ESTADOS)[number];

const PROGRAMA_TRANSITIONS: Record<ProgramaEstado, readonly ProgramaEstado[]> = {
  borrador: ['publicado'],
  publicado: ['archivado'],
  archivado: [],
};

const GRUPO_TRANSITIONS: Record<GrupoEstado, readonly GrupoEstado[]> = {
  abierto: ['cerrado'],
  cerrado: [],
};

const MATRICULA_TRANSITIONS: Record<MatriculaEstado, readonly MatriculaEstado[]> = {
  preinscrita: ['confirmada', 'cancelada'],
  confirmada: ['activa', 'cancelada', 'retirada'],
  activa: ['finalizada', 'cancelada', 'retirada'],
  finalizada: [],
  cancelada: [],
  retirada: [],
};

export const VIGENT_MATRICULA_STATES: readonly MatriculaEstado[] = [
  'preinscrita',
  'confirmada',
  'activa',
];

export const CAPACITY_MATRICULA_STATES: readonly MatriculaEstado[] = ['confirmada', 'activa'];

/**
 * Códigos del catálogo de auditoría y de plantillas de notificación (D67).
 * Los estados `preinscrita` y `activa` no son nombres de evento: se publican
 * como `matricula.creada` y `matricula.activada` para que la notificación
 * encuentre su plantilla y la auditoría valide contra el catálogo (R-031).
 */
const MATRICULA_EVENT_CODES: Record<MatriculaEstado, string> = {
  preinscrita: 'matricula.creada',
  confirmada: 'matricula.confirmada',
  activa: 'matricula.activada',
  finalizada: 'matricula.finalizada',
  cancelada: 'matricula.cancelada',
  retirada: 'matricula.retirada',
};

export function matriculaEventCode(estado: MatriculaEstado): string {
  return MATRICULA_EVENT_CODES[estado];
}

export function canTransitionPrograma(from: ProgramaEstado, to: ProgramaEstado): boolean {
  return PROGRAMA_TRANSITIONS[from].includes(to);
}

export function canTransitionGrupo(from: GrupoEstado, to: GrupoEstado): boolean {
  return GRUPO_TRANSITIONS[from].includes(to);
}

export function canTransitionMatricula(from: MatriculaEstado, to: MatriculaEstado): boolean {
  return MATRICULA_TRANSITIONS[from].includes(to);
}

const PERIOD_PATTERN = /^[0-9]{4}-[0-9]+$/u;

/** Convención R-008: `YYYY-P` (p. ej. `2026-1`). */
export function isValidPeriod(value: string): boolean {
  return PERIOD_PATTERN.test(value);
}

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/u;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** Rango válido: `hora_fin` estrictamente posterior a `hora_inicio`. */
export function isValidScheduleRange(horaInicio: string, horaFin: string): boolean {
  return isValidTime(horaInicio) && isValidTime(horaFin) && horaFin > horaInicio;
}

/** Dos franjas del mismo día se solapan si sus intervalos se cruzan. */
export function rangesOverlap(
  left: { diaSemana: number; horaInicio: string; horaFin: string },
  right: { diaSemana: number; horaInicio: string; horaFin: string },
): boolean {
  return (
    left.diaSemana === right.diaSemana &&
    left.horaInicio < right.horaFin &&
    right.horaInicio < left.horaFin
  );
}
