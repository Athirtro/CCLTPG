import { describe, expect, it } from 'vitest';

import {
  CRITICAL_EVENT_PREFIXES,
  isCriticalEvent,
  isEventName,
  isNotificationChannel,
  NOTIFICATION_CHANNELS,
} from './notification-policy.js';

/**
 * D55: las notificaciones críticas no se pueden silenciar y el catálogo de
 * canales es cerrado.
 */

describe('política de notificaciones', () => {
  it('mantiene solo los canales app y email', () => {
    expect([...NOTIFICATION_CHANNELS]).toEqual(['app', 'email']);
    expect(isNotificationChannel('app')).toBe(true);
    expect(isNotificationChannel('email')).toBe(true);
    for (const canal of ['sms', 'push', 'APP', '']) {
      expect(isNotificationChannel(canal), canal).toBe(false);
    }
  });

  it('marca como críticos matrícula, seguridad y cambio de contraseña', () => {
    for (const evento of [
      'matricula.confirmada',
      'matricula.anulada',
      'seguridad.acceso_denegado',
      'usuario.password_cambiada',
      'usuario.password_reseteada',
    ]) {
      expect(isCriticalEvent(evento), evento).toBe(true);
    }

    for (const evento of ['reporte.generado', 'archivo.subido', 'usuario.creado']) {
      expect(isCriticalEvent(evento), evento).toBe(false);
    }

    expect([...CRITICAL_EVENT_PREFIXES]).toEqual([
      'matricula.',
      'horario.',
      'evaluacion.',
      'seguridad.',
      'usuario.password_',
      'rejilla.aprobada',
      'incentivo.asignado',
      'transmision.autorizada',
    ]);
  });

  it('marca como críticos los hitos de la emisora R.A.C.', () => {
    for (const evento of ['rejilla.aprobada', 'incentivo.asignado', 'transmision.autorizada']) {
      expect(isCriticalEvent(evento), evento).toBe(true);
      expect(isEventName(evento), evento).toBe(true);
    }
    expect(isCriticalEvent('convocatoria.abierta')).toBe(false);
  });

  it('D85: evaluacion.publicada es crítica y recordatorio.fechas respeta preferencias', () => {
    expect(isCriticalEvent('evaluacion.publicada')).toBe(true);
    expect(isCriticalEvent('recordatorio.fechas')).toBe(false);
    expect(isEventName('evaluacion.publicada')).toBe(true);
    expect(isEventName('recordatorio.fechas')).toBe(true);
  });

  it('exige el formato dominio.accion del catálogo de auditoría', () => {
    for (const evento of ['reporte.generado', 'archivo.subido', 'usuario.password_cambiada']) {
      expect(isEventName(evento), evento).toBe(true);
    }

    for (const evento of [
      'Reporte.generado',
      'reporte',
      'reporte.Generado',
      'reporte..generado',
      '',
    ]) {
      expect(isEventName(evento), evento).toBe(false);
    }
  });
});
