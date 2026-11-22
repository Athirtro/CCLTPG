import { Inject, Injectable } from '@nestjs/common';

import type { RequestContext } from '../../../shared/http/request-context.js';
import { NotificationError } from './notification-error.js';
import type { NotificationPage, PreferenceRecord } from './notification.types.js';
import { NotificationRepository } from './ports/notification.repository.js';
import { NotificationsUnitOfWork } from './ports/unit-of-work.js';
import {
  CRITICAL_EVENT_PREFIXES,
  isCriticalEvent,
  isEventName,
  isNotificationChannel,
} from '../domain/notification-policy.js';

export interface NotificationActor {
  userId: string;
  actorProfile: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NotificationRepository) private readonly repository: NotificationRepository,
    @Inject(NotificationsUnitOfWork) private readonly unitOfWork: NotificationsUnitOfWork,
  ) {}

  list(
    userId: string,
    filter: { soloNoLeidas: boolean; limit: number; offset: number },
  ): Promise<NotificationPage> {
    return this.repository.listByUser(userId, filter);
  }

  async markRead(userId: string, id: string, leida: boolean): Promise<void> {
    const notification = await this.repository.findById(id);
    if (!notification || notification.usuarioId !== userId) {
      throw NotificationError.notFound();
    }

    await this.repository.setRead(id, leida ? new Date() : null);
  }

  async getPreferences(userId: string): Promise<{
    preferencias: PreferenceRecord[];
    criticos: readonly string[];
  }> {
    return {
      preferencias: await this.repository.listPreferences(userId),
      criticos: CRITICAL_EVENT_PREFIXES,
    };
  }

  async updatePreferences(
    actor: NotificationActor,
    entries: PreferenceRecord[],
    context: RequestContext,
  ): Promise<{ preferencias: PreferenceRecord[]; criticos: readonly string[] }> {
    if (entries.length === 0) {
      throw NotificationError.preferenceInvalid('Debe enviar al menos una preferencia.');
    }

    const seen = new Set<string>();
    for (const entry of entries) {
      if (!isEventName(entry.evento)) {
        throw NotificationError.preferenceInvalid(`Evento inválido: "${entry.evento}".`);
      }
      if (!isNotificationChannel(entry.canal)) {
        throw NotificationError.preferenceInvalid(`Canal inválido: "${String(entry.canal)}".`);
      }
      if (!entry.habilitado && isCriticalEvent(entry.evento)) {
        throw NotificationError.criticalNotSilenceable(entry.evento);
      }

      const key = `${entry.evento}:${entry.canal}`;
      if (seen.has(key)) {
        throw NotificationError.preferenceInvalid(`Preferencia duplicada: "${key}".`);
      }
      seen.add(key);
    }

    const before = await this.repository.listPreferences(actor.userId);

    await this.unitOfWork.run(async (tx) => {
      await tx.notifications.upsertPreferences(actor.userId, entries);
      const after = await tx.notifications.listPreferences(actor.userId);

      const changed = diffPreferences(before, after);
      if (changed.length > 0) {
        await tx.audit.record({
          accion: 'preferencia.actualizada',
          recurso: 'usuario',
          recursoId: actor.userId,
          actorId: actor.userId,
          actorPerfil: actor.actorProfile,
          ip: context.ip,
          dispositivo: context.userAgent,
          datosAntes: changed.map((item) => ({
            evento: item.evento,
            canal: item.canal,
            habilitado: item.antes,
          })),
          datosDespues: changed.map((item) => ({
            evento: item.evento,
            canal: item.canal,
            habilitado: item.despues,
          })),
          requestId: context.requestId,
        });
      }
    });

    return this.getPreferences(actor.userId);
  }
}

interface PreferenceChange {
  evento: string;
  canal: PreferenceRecord['canal'];
  antes: boolean | null;
  despues: boolean | null;
}

function diffPreferences(
  before: PreferenceRecord[],
  after: PreferenceRecord[],
): PreferenceChange[] {
  const keyOf = (preference: PreferenceRecord): string =>
    `${preference.evento}:${preference.canal}`;
  const previous = new Map(before.map((item) => [keyOf(item), item.habilitado]));
  const current = new Map(after.map((item) => [keyOf(item), item.habilitado]));

  const changes: PreferenceChange[] = [];
  for (const key of new Set([...previous.keys(), ...current.keys()])) {
    const antes = previous.get(key) ?? null;
    const despues = current.get(key) ?? null;
    if (antes === despues) {
      continue;
    }

    const [evento, canal] = key.split(':') as [string, PreferenceRecord['canal']];
    changes.push({ evento, canal, antes, despues });
  }

  return changes;
}
