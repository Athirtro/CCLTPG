/**
 * Política de notificaciones (D55).
 *
 * Los eventos críticos no se pueden silenciar. La lista se expresa por prefijo
 * para no tener que mantener un catálogo paralelo al de auditoría.
 */

export const NOTIFICATION_CHANNELS = ['app', 'email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const CRITICAL_EVENT_PREFIXES = [
  'matricula.',
  'horario.',
  'evaluacion.',
  'seguridad.',
  'usuario.password_',
  // Emisora R.A.C. (plan §7): no se pueden silenciar hitos de rejilla,
  // incentivos ni autorizaciones de transmisión.
  'rejilla.aprobada',
  'incentivo.asignado',
  'transmision.autorizada',
] as const;

export function isCriticalEvent(evento: string): boolean {
  return CRITICAL_EVENT_PREFIXES.some((prefix) => evento.startsWith(prefix));
}

export function isNotificationChannel(value: string): value is NotificationChannel {
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}

/** Evento con formato `dominio.accion` del catálogo de auditoría. */
export function isEventName(value: string): boolean {
  return /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/u.test(value);
}
