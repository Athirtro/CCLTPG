import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { AuditPort } from '../../../shared/audit/audit.port.js';
import { EMAIL_SENDER, type EmailSender } from '../../../shared/email/email-sender.port.js';
import type { DomainEvent } from '../../../shared/events/outbox.port.js';
import { isCriticalEvent, NOTIFICATION_CHANNELS } from '../domain/notification-policy.js';
import type { NotificationsTransactionContext } from './ports/unit-of-work.js';

/**
 * Consumidor de eventos de la outbox (RB1-23).
 *
 * Resuelve destinatarios, aplica preferencias (las críticas no se silencian),
 * persiste la notificación y entrega por `app` o `email`. El envío de correo es
 * un stub en C3; el fallo se registra como `notificacion.fallida` sin PII.
 */
@Injectable()
export class NotificationDispatcher {
  constructor(@Inject(EMAIL_SENDER) private readonly email: EmailSender) {}

  async dispatch(event: DomainEvent, tx: NotificationsTransactionContext): Promise<void> {
    const recipients = recipientsOf(event);
    if (recipients.length === 0) {
      return;
    }

    for (const usuarioId of recipients) {
      for (const canal of NOTIFICATION_CHANNELS) {
        if (!isCriticalEvent(event.tipo)) {
          const enabled = await tx.notifications.isChannelEnabled(usuarioId, event.tipo, canal);
          if (!enabled) {
            continue;
          }
        }

        const template = await tx.notifications.findTemplate(event.tipo, canal);
        const created = await tx.notifications.createNotification({
          id: uuidv7(),
          usuarioId,
          evento: event.tipo,
          eventoId: event.id,
          canal,
          plantillaId: template?.id ?? null,
          payload: event.payload,
        });

        if (!created) {
          continue;
        }

        try {
          if (canal === 'email') {
            const contact = await tx.notifications.findUserContact(usuarioId);
            if (!contact) {
              throw new DeliveryError('CONTACT_NOT_FOUND');
            }

            await this.email.send({
              to: contact.email,
              subject: template?.asunto ?? 'Nueva notificación',
              body: template?.cuerpo ?? 'Tienes una novedad en la plataforma.',
            });
          }

          await tx.notifications.markDelivered(created.id, 'enviada', new Date());
          await auditDelivery(tx.audit, {
            accion: 'notificacion.enviada',
            notificacionId: created.id,
            canal,
            plantilla: template?.codigo ?? 'notificacion.generica',
            requestId: event.id,
          });
        } catch (error) {
          await tx.notifications.markFailed(created.id);
          await auditDelivery(tx.audit, {
            accion: 'notificacion.fallida',
            notificacionId: created.id,
            canal,
            motivo: error instanceof DeliveryError ? error.code : 'DELIVERY_ERROR',
            requestId: event.id,
          });
        }
      }
    }
  }
}

class DeliveryError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function recipientsOf(event: DomainEvent): string[] {
  const raw = event.payload.usuarioIds;
  if (!Array.isArray(raw)) {
    return event.usuarioIds ?? [];
  }

  return raw.filter((value): value is string => typeof value === 'string' && value.length > 0);
}

async function auditDelivery(
  audit: AuditPort,
  input: {
    accion: 'notificacion.enviada' | 'notificacion.fallida';
    notificacionId: string;
    canal: string;
    plantilla?: string;
    motivo?: string;
    requestId: string;
  },
): Promise<void> {
  await audit.record({
    accion: input.accion,
    recurso: 'notificacion',
    recursoId: input.notificacionId,
    datosDespues:
      input.accion === 'notificacion.enviada'
        ? { canal: input.canal, plantilla: input.plantilla }
        : { canal: input.canal, motivo: input.motivo },
    requestId: input.requestId,
  });
}
