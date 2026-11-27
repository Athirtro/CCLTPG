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

export const PATROCINIO_ESTADOS = ['propuesto', 'aprobado', 'rechazado'] as const;
export type PatrocinioEstado = (typeof PATROCINIO_ESTADOS)[number];

export const PROMO_ESTADOS = ['borrador', 'producida'] as const;
export type PromoEstado = (typeof PROMO_ESTADOS)[number];

export const ORDEN_EMISION_ESTADOS = ['borrador', 'programada', 'emitida'] as const;
export type OrdenEmisionEstado = (typeof ORDEN_EMISION_ESTADOS)[number];

export const PUBLICACION_ESTADOS = ['programada', 'publicada'] as const;
export type PublicacionEstado = (typeof PUBLICACION_ESTADOS)[number];

export const TRANSMISION_ESTADOS = ['programada', 'autorizada', 'realizada', 'cancelada'] as const;
export type TransmisionEstado = (typeof TRANSMISION_ESTADOS)[number];

export const PRESTAMO_ESTADOS = [
  'solicitado',
  'autorizado',
  'entregado',
  'devuelto',
  'rechazado',
] as const;
export type PrestamoEstado = (typeof PRESTAMO_ESTADOS)[number];

export const VIATICO_ESTADOS = [
  'solicitado',
  'resuelto',
  'comprometido',
  'orden_generada',
] as const;
export type ViaticoEstado = (typeof VIATICO_ESTADOS)[number];

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

/** Tabla cerrada de transiciones E3; la misma forma que las de E2. */
const TRANSICIONES_E3 = {
  patrocinio: { propuesto: ['aprobado', 'rechazado'], aprobado: [], rechazado: [] },
  promo: { borrador: ['producida'], producida: [] },
  orden: { borrador: ['programada'], programada: ['emitida'], emitida: [] },
  publicacion: { programada: ['publicada'], publicada: [] },
  transmision: {
    programada: ['autorizada', 'cancelada'],
    autorizada: ['realizada', 'cancelada'],
    realizada: [],
    cancelada: [],
  },
  prestamo: {
    solicitado: ['autorizado', 'rechazado'],
    autorizado: ['entregado', 'rechazado'],
    entregado: ['devuelto'],
    devuelto: [],
    rechazado: [],
  },
} as const;

export type AgregadoE3 = keyof typeof TRANSICIONES_E3;

/** RF-04…RF-06: valida la transición antes de escribir y dentro de la UoW. */
export function canTransicionarE3(agregado: AgregadoE3, from: string, to: string): boolean {
  const permitidas = TRANSICIONES_E3[agregado] as Record<string, readonly string[]>;
  return permitidas[from]?.includes(to) ?? false;
}
