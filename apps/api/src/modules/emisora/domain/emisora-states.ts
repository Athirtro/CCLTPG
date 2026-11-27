/**
 * Estados y transiciones de la Emisora R.A.C. (plan §4.2).
 *
 * Se declaran como uniones cerradas para que el compilador impida estados
 * inexistentes. Las transiciones se validan en dominio, antes de escribir, y se
 * refuerzan con `SELECT ... FOR UPDATE` en el repositorio transaccional.
 */

export const CONVOCATORIA_ESTADOS = ['borrador', 'abierta', 'cerrada'] as const;
export type ConvocatoriaEstado = (typeof CONVOCATORIA_ESTADOS)[number];

export const PROYECTO_ESTADOS = ['recibido', 'en_revision', 'aprobado', 'rechazado'] as const;
export type ProyectoEstado = (typeof PROYECTO_ESTADOS)[number];

export const REJILLA_ESTADOS = ['borrador', 'aprobada'] as const;
export type RejillaEstado = (typeof REJILLA_ESTADOS)[number];

export const PROGRAMACION_ESTADOS = ['borrador', 'aprobada'] as const;
export type ProgramacionEstado = (typeof PROGRAMACION_ESTADOS)[number];

export const GRABACION_ESTADOS = ['programada', 'realizada', 'aprobada', 'cancelada'] as const;
export type GrabacionEstado = (typeof GRABACION_ESTADOS)[number];

export const INCENTIVO_ESTADOS = ['calificado', 'asignado', 'resuelto', 'solicitud_cdp'] as const;
export type IncentivoEstado = (typeof INCENTIVO_ESTADOS)[number];

export const FRANJA_TIPOS = ['programa', 'promo', 'mencion', 'espacio'] as const;
export type FranjaTipo = (typeof FRANJA_TIPOS)[number];

export const AUDIO_TIPOS = ['programa', 'entrevista', 'promo', 'cotidiano'] as const;
export type AudioTipo = (typeof AUDIO_TIPOS)[number];

export const ASISTENCIA_ESTADOS = ['presente', 'ausente', 'tarde', 'excusa'] as const;
export type AsistenciaEstado = (typeof ASISTENCIA_ESTADOS)[number];

/** RF-03.3: solo borrador → aprobada, y siempre con acta de comité adjunta. */
export function canTransicionarRejilla(from: RejillaEstado, to: RejillaEstado): boolean {
  return from === 'borrador' && to === 'aprobada';
}

/** RF-01: la aprobación solo se hace desde borrador. */
export function canTransicionarProgramacion(
  from: ProgramacionEstado,
  to: ProgramacionEstado,
): boolean {
  return from === 'borrador' && to === 'aprobada';
}

/** RF-02.1: programada → realizada → aprobada; cancelada es terminal. */
export function canTransicionarGrabacion(from: GrabacionEstado, to: GrabacionEstado): boolean {
  return (
    (from === 'programada' && (to === 'realizada' || to === 'cancelada')) ||
    (from === 'realizada' && (to === 'aprobada' || to === 'cancelada'))
  );
}

/** RF-03.6: calificado → asignado → (resuelto | solicitud_cdp). */
export function canTransicionarIncentivo(from: IncentivoEstado, to: IncentivoEstado): boolean {
  return (
    (from === 'calificado' && to === 'asignado') ||
    (from === 'asignado' && (to === 'resuelto' || to === 'solicitud_cdp'))
  );
}
