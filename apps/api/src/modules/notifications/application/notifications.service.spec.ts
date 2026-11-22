import { describe, expect, it, vi } from 'vitest';

import type { AuditEvent, AuditPort } from '../../../shared/audit/audit.port.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { RequestContext } from '../../../shared/http/request-context.js';
import { NotificationsService } from './notifications.service.js';
import type {
  NotificationFilter,
  NotificationPage,
  NotificationRecord,
  NotificationTemplateRecord,
  PreferenceRecord,
  UserContact,
} from './notification.types.js';
import type { NotificationRepository } from './ports/notification.repository.js';
import type {
  NotificationsTransactionContext,
  NotificationsUnitOfWork,
} from './ports/unit-of-work.js';

/**
 * RB1-23: bandeja propia, preferencias y regla de no silenciar críticas.
 */

const USER = '0190f000-0000-7000-8000-000000000001';
const OTHER = '0190f000-0000-7000-8000-000000000002';
const CONTEXT: RequestContext = {
  ip: '127.0.0.1',
  userAgent: 'vitest',
  requestId: 'req-notif',
};

function notification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: '0190f000-0000-7000-8000-0000000000aa',
    usuarioId: USER,
    evento: 'reporte.generado',
    eventoId: null,
    canal: 'app',
    plantillaId: null,
    asunto: null,
    cuerpo: null,
    payload: {},
    estado: 'enviada',
    leidaEn: null,
    enviadaEn: new Date('2026-11-19T10:00:00Z'),
    creadoEn: new Date('2026-11-19T10:00:00Z'),
    ...overrides,
  };
}

function harness(
  options: {
    notifications?: NotificationRecord[];
    preferences?: PreferenceRecord[];
  } = {},
) {
  const items = options.notifications ?? [];
  const preferences = new Map<string, PreferenceRecord>();
  for (const preference of options.preferences ?? []) {
    preferences.set(`${preference.evento}:${preference.canal}`, preference);
  }

  const listByUser = vi.fn((_userId: string, _filter: NotificationFilter) =>
    Promise.resolve<NotificationPage>({ items, total: items.length }),
  );
  const findById = vi.fn((id: string) =>
    Promise.resolve(items.find((item) => item.id === id) ?? null),
  );
  const setRead = vi.fn((_id: string, _leidaEn: Date | null) => Promise.resolve());
  const listPreferences = vi.fn((userId: string) =>
    Promise.resolve(
      [...preferences.values()]
        .filter(() => userId === USER)
        .sort((a, b) => `${a.evento}:${a.canal}`.localeCompare(`${b.evento}:${b.canal}`)),
    ),
  );
  const upsertPreferences = vi.fn((_userId: string, entries: PreferenceRecord[]) => {
    for (const entry of entries) {
      preferences.set(`${entry.evento}:${entry.canal}`, entry);
    }
    return Promise.resolve();
  });

  const repository: NotificationRepository = {
    listByUser,
    findById,
    setRead,
    listPreferences,
    upsertPreferences,
    findTemplate: vi.fn(() => Promise.resolve<NotificationTemplateRecord | null>(null)),
    createNotification: vi.fn(() => Promise.resolve<NotificationRecord | null>(null)),
    markDelivered: vi.fn(() => Promise.resolve()),
    markFailed: vi.fn(() => Promise.resolve()),
    findUserContact: vi.fn(() => Promise.resolve<UserContact | null>(null)),
    isChannelEnabled: vi.fn(() => Promise.resolve(true)),
  };

  const auditRecord = vi.fn((_event: AuditEvent) => Promise.resolve());
  const audit: AuditPort = { record: auditRecord };

  const unitOfWork: NotificationsUnitOfWork = {
    run: <T>(callback: (tx: NotificationsTransactionContext) => Promise<T>) =>
      callback({ notifications: repository, audit }),
  };

  const service = new NotificationsService(repository, unitOfWork);
  return {
    service,
    repository,
    preferences,
    auditRecord,
    listByUser,
    setRead,
    upsertPreferences,
  };
}

async function codeOf(run: Promise<unknown>): Promise<string> {
  const error = await run.then(
    () => null,
    (failure: unknown) => failure,
  );
  expect(error).toBeInstanceOf(AppError);
  return (error as AppError).code;
}

describe('servicio de notificaciones', () => {
  it('lista solo la bandeja del usuario autenticado', async () => {
    const h = harness({ notifications: [notification()] });
    await expect(
      h.service.list(USER, { soloNoLeidas: true, limit: 10, offset: 5 }),
    ).resolves.toMatchObject({ total: 1 });
    expect(h.listByUser).toHaveBeenCalledWith(USER, {
      soloNoLeidas: true,
      limit: 10,
      offset: 5,
    });
  });

  it('marca como leída una notificación propia', async () => {
    const h = harness({ notifications: [notification()] });
    await h.service.markRead(USER, notification().id, true);
    expect(h.setRead).toHaveBeenCalledWith(notification().id, expect.any(Date));
  });

  it('oculta como 404 una notificación ajena o inexistente', async () => {
    const h = harness({ notifications: [notification()] });
    await expect(codeOf(h.service.markRead(OTHER, notification().id, true))).resolves.toBe(
      'NOTIFICATION_NOT_FOUND',
    );
    await expect(codeOf(h.service.markRead(USER, 'no-existe', true))).resolves.toBe(
      'NOTIFICATION_NOT_FOUND',
    );
    expect(h.setRead).not.toHaveBeenCalled();
  });

  it('expone el catálogo de eventos críticos junto a las preferencias', async () => {
    const h = harness({
      preferences: [{ evento: 'reporte.generado', canal: 'app', habilitado: false }],
    });
    await expect(h.service.getPreferences(USER)).resolves.toEqual({
      preferencias: [{ evento: 'reporte.generado', canal: 'app', habilitado: false }],
      criticos: ['matricula.', 'horario.', 'evaluacion.', 'seguridad.', 'usuario.password_'],
    });
  });

  it('rechaza actualizaciones vacías, inválidas o duplicadas', async () => {
    const h = harness();

    await expect(
      codeOf(h.service.updatePreferences({ userId: USER, actorProfile: null }, [], CONTEXT)),
    ).resolves.toBe('NOTIFICATION_PREFERENCE_INVALID');
    await expect(
      codeOf(
        h.service.updatePreferences(
          { userId: USER, actorProfile: null },
          [{ evento: 'Reporte', canal: 'app', habilitado: true }],
          CONTEXT,
        ),
      ),
    ).resolves.toBe('NOTIFICATION_PREFERENCE_INVALID');
    await expect(
      codeOf(
        h.service.updatePreferences(
          { userId: USER, actorProfile: null },
          [{ evento: 'reporte.generado', canal: 'sms' as never, habilitado: true }],
          CONTEXT,
        ),
      ),
    ).resolves.toBe('NOTIFICATION_PREFERENCE_INVALID');
    await expect(
      codeOf(
        h.service.updatePreferences(
          { userId: USER, actorProfile: null },
          [
            { evento: 'reporte.generado', canal: 'app', habilitado: true },
            { evento: 'reporte.generado', canal: 'app', habilitado: false },
          ],
          CONTEXT,
        ),
      ),
    ).resolves.toBe('NOTIFICATION_PREFERENCE_INVALID');

    expect(h.upsertPreferences).not.toHaveBeenCalled();
  });

  it('no permite silenciar un evento crítico', async () => {
    const h = harness();
    await expect(
      codeOf(
        h.service.updatePreferences(
          { userId: USER, actorProfile: 'educador' },
          [{ evento: 'matricula.confirmada', canal: 'email', habilitado: false }],
          CONTEXT,
        ),
      ),
    ).resolves.toBe('NOTIFICATION_CRITICAL_NOT_SILENCEABLE');
    expect(h.upsertPreferences).not.toHaveBeenCalled();
  });

  it('persiste el cambio y audita el diff antes/después', async () => {
    const h = harness({
      preferences: [{ evento: 'reporte.generado', canal: 'app', habilitado: true }],
    });

    const result = await h.service.updatePreferences(
      { userId: USER, actorProfile: 'administrador' },
      [{ evento: 'reporte.generado', canal: 'app', habilitado: false }],
      CONTEXT,
    );

    expect(result.preferencias).toEqual([
      { evento: 'reporte.generado', canal: 'app', habilitado: false },
    ]);
    expect(h.upsertPreferences).toHaveBeenCalledWith(USER, [
      { evento: 'reporte.generado', canal: 'app', habilitado: false },
    ]);
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'preferencia.actualizada',
        recurso: 'usuario',
        recursoId: USER,
        actorPerfil: 'administrador',
        datosAntes: [{ evento: 'reporte.generado', canal: 'app', habilitado: true }],
        datosDespues: [{ evento: 'reporte.generado', canal: 'app', habilitado: false }],
        requestId: 'req-notif',
      }),
    );
  });

  it('no audita si no hubo cambios reales', async () => {
    const h = harness({
      preferences: [{ evento: 'reporte.generado', canal: 'app', habilitado: true }],
    });

    await h.service.updatePreferences(
      { userId: USER, actorProfile: null },
      [{ evento: 'reporte.generado', canal: 'app', habilitado: true }],
      CONTEXT,
    );

    expect(h.auditRecord).not.toHaveBeenCalled();
  });
});
