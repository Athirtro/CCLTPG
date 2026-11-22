import { describe, expect, it, vi } from 'vitest';

import type { AuditEvent, AuditPort } from '../../../shared/audit/audit.port.js';
import type { EmailMessage, EmailSender } from '../../../shared/email/email-sender.port.js';
import type { DomainEvent } from '../../../shared/events/outbox.port.js';
import { NotificationDispatcher } from './notification-dispatcher.js';
import type {
  NewNotification,
  NotificationRecord,
  NotificationTemplateRecord,
  UserContact,
} from './notification.types.js';
import type { NotificationRepository } from './ports/notification.repository.js';
import type { NotificationsTransactionContext } from './ports/unit-of-work.js';

/**
 * RB1-23: la outbox se consume una vez, las preferencias se respetan salvo en
 * eventos críticos y los fallos de entrega quedan auditados sin PII.
 */

const USER = '0190f000-0000-7000-8000-000000000001';

function event(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: '0190f000-0000-7000-8000-0000000000ee',
    tipo: 'reporte.generado',
    agregado: 'archivo',
    ocurridoEn: new Date('2026-11-19T10:00:00Z'),
    payload: { archivoId: 'archivo-1' },
    usuarioIds: [USER],
    ...overrides,
  };
}

function harness(
  options: {
    enabled?: boolean;
    contact?: UserContact | null;
    template?: NotificationTemplateRecord | null;
    created?: boolean;
    emailFails?: boolean;
  } = {},
) {
  const createNotification = vi.fn((input: NewNotification) =>
    Promise.resolve<NotificationRecord | null>(
      options.created === false
        ? null
        : {
            id: input.id,
            usuarioId: input.usuarioId,
            evento: input.evento,
            eventoId: input.eventoId,
            canal: input.canal,
            plantillaId: input.plantillaId,
            asunto: null,
            cuerpo: null,
            payload: input.payload,
            estado: 'pendiente',
            leidaEn: null,
            enviadaEn: null,
            creadoEn: new Date('2026-11-19T10:00:00Z'),
          },
    ),
  );

  const findTemplate = vi.fn((_evento: string, canal: 'app' | 'email') =>
    Promise.resolve(
      options.template === undefined
        ? {
            id: `plantilla-${canal}`,
            codigo: 'notificacion.generica',
            canal,
            asunto: 'Nueva notificación',
            cuerpo: 'Tienes una novedad en la plataforma.',
          }
        : options.template,
    ),
  );
  const markDelivered = vi.fn(() => Promise.resolve());
  const markFailed = vi.fn(() => Promise.resolve());
  const findUserContact = vi.fn(() => Promise.resolve(options.contact ?? null));
  const isChannelEnabled = vi.fn(() => Promise.resolve(options.enabled ?? true));

  const notifications: NotificationRepository = {
    listByUser: vi.fn(),
    findById: vi.fn(),
    setRead: vi.fn(),
    listPreferences: vi.fn(),
    upsertPreferences: vi.fn(),
    findTemplate,
    createNotification,
    markDelivered,
    markFailed,
    findUserContact,
    isChannelEnabled,
  };

  const auditRecord = vi.fn((_event: AuditEvent) => Promise.resolve());
  const audit: AuditPort = { record: auditRecord };

  const send = vi.fn((_message: EmailMessage) =>
    options.emailFails ? Promise.reject(new Error('SMTP caído')) : Promise.resolve(),
  );
  const email: EmailSender = { send };

  const tx: NotificationsTransactionContext = { notifications, audit };
  const dispatcher = new NotificationDispatcher(email);

  return {
    dispatcher,
    tx,
    notifications,
    auditRecord,
    send,
    createNotification,
    markDelivered,
    markFailed,
    isChannelEnabled,
  };
}

describe('consumidor de notificaciones (outbox)', () => {
  it('no hace nada si el evento no tiene destinatarios', async () => {
    const h = harness();
    await h.dispatcher.dispatch(event({ usuarioIds: [], payload: {} }), h.tx);
    expect(h.createNotification).not.toHaveBeenCalled();
  });

  it('acepta destinatarios del payload y descarta valores no textuales', async () => {
    const h = harness({ contact: { email: 'docente@ccltpg.org', nombre: 'Docente' } });
    await h.dispatcher.dispatch(
      event({ usuarioIds: undefined, payload: { usuarioIds: [USER, 42, ''] } }),
      h.tx,
    );

    expect(h.createNotification).toHaveBeenCalledTimes(2);
    expect(h.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: USER,
        eventoId: '0190f000-0000-7000-8000-0000000000ee',
      }),
    );
  });

  it('respeta el silenciamiento de eventos no críticos', async () => {
    const h = harness({ enabled: false });
    await h.dispatcher.dispatch(event(), h.tx);

    expect(h.isChannelEnabled).toHaveBeenCalledTimes(2);
    expect(h.createNotification).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it('entrega siempre los eventos críticos aunque estén silenciados', async () => {
    const h = harness({
      enabled: false,
      contact: { email: 'estudiante@ccltpg.org', nombre: 'Estudiante' },
    });

    await h.dispatcher.dispatch(event({ tipo: 'matricula.confirmada' }), h.tx);

    expect(h.isChannelEnabled).not.toHaveBeenCalled();
    expect(h.createNotification).toHaveBeenCalledTimes(2);
    expect(h.send).toHaveBeenCalledWith({
      to: 'estudiante@ccltpg.org',
      subject: 'Nueva notificación',
      body: 'Tienes una novedad en la plataforma.',
    });
  });

  it('marca como enviada y audita cada canal entregado', async () => {
    const h = harness({ contact: { email: 'docente@ccltpg.org', nombre: 'Docente' } });

    await h.dispatcher.dispatch(event(), h.tx);

    expect(h.markDelivered).toHaveBeenCalledTimes(2);
    expect(h.markDelivered).toHaveBeenCalledWith(expect.any(String), 'enviada', expect.any(Date));
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'notificacion.enviada',
        recurso: 'notificacion',
        requestId: '0190f000-0000-7000-8000-0000000000ee',
      }),
    );
  });

  it('marca fallida y audita cuando falta el contacto de correo', async () => {
    const h = harness({ contact: null });

    await h.dispatcher.dispatch(event(), h.tx);

    expect(h.send).not.toHaveBeenCalled();
    expect(h.markFailed).toHaveBeenCalledTimes(1);
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'notificacion.fallida',
        datosDespues: { canal: 'email', motivo: 'CONTACT_NOT_FOUND' },
      }),
    );
  });

  it('marca fallida cuando el proveedor de correo falla', async () => {
    const h = harness({
      contact: { email: 'docente@ccltpg.org', nombre: 'Docente' },
      emailFails: true,
    });

    await h.dispatcher.dispatch(event(), h.tx);

    expect(h.markFailed).toHaveBeenCalledWith(expect.any(String));
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'notificacion.fallida',
        datosDespues: { canal: 'email', motivo: 'DELIVERY_ERROR' },
      }),
    );
  });

  it('no reentrega una notificación ya creada para el mismo evento', async () => {
    const h = harness({ created: false });

    await h.dispatcher.dispatch(event(), h.tx);

    expect(h.markDelivered).not.toHaveBeenCalled();
    expect(h.auditRecord).not.toHaveBeenCalled();
  });
});
