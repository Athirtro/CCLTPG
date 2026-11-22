import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../../database/database.module.js';
import { KyselyAuditWriter } from '../../../database/audit/kysely-audit.writer.js';
import type { Database } from '../../../database/schema.js';
import { env } from '../../../shared/config/env.js';
import type { DomainEvent } from '../../../shared/events/outbox.port.js';
import { NotificationDispatcher } from '../application/notification-dispatcher.js';
import { KyselyNotificationRepository } from './persistence/kysely-notification.repository.js';

const STUCK_AFTER_MS = 5 * 60 * 1000;

/**
 * Trabajador en proceso de la outbox (D53).
 *
 * Usa `FOR UPDATE SKIP LOCKED` para que varias instancias no procesen el mismo
 * evento. La entrega es al menos una vez; la unicidad
 * `(evento_id, usuario_id, canal)` evita duplicar notificaciones.
 */
@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(DATABASE) private readonly db: Kysely<Database>,
    @Inject(NotificationDispatcher) private readonly dispatcher: NotificationDispatcher,
  ) {}

  onModuleInit(): void {
    if (!env.OUTBOX_WORKER_ENABLED || env.isTest) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, env.OUTBOX_POLL_INTERVAL_MS);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Procesa un lote; expuesto para pruebas de integración deterministas. */
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      await this.recoverStuck();
      const ids = await this.claimBatch();

      for (const id of ids) {
        try {
          await this.process(id);
        } catch (error) {
          this.logger.warn(`Fallo al procesar evento de outbox ${id}: ${safeCode(error)}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Fallo del ciclo de outbox: ${safeCode(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async recoverStuck(): Promise<void> {
    const threshold = new Date(Date.now() - STUCK_AFTER_MS);
    await this.db
      .updateTable('evento_outbox')
      .set({ estado: 'pendiente' })
      .where('estado', '=', 'procesando')
      .where('disponible_en', '<', threshold)
      .execute();
  }

  private async claimBatch(): Promise<string[]> {
    return this.db.transaction().execute(async (trx) => {
      const now = new Date();
      const rows = await trx
        .selectFrom('evento_outbox')
        .select('id')
        .where('estado', 'in', ['pendiente', 'procesando'])
        .where('disponible_en', '<=', now)
        .orderBy('creado_en', 'asc')
        .limit(env.OUTBOX_BATCH_SIZE)
        .forUpdate()
        .skipLocked()
        .execute();

      if (rows.length === 0) {
        return [];
      }

      const ids = rows.map((row) => row.id);
      await trx
        .updateTable('evento_outbox')
        .set({ estado: 'procesando' })
        .where('id', 'in', ids)
        .execute();

      return ids;
    });
  }

  private async process(id: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom('evento_outbox')
        .selectAll()
        .where('id', '=', id)
        .where('estado', '=', 'procesando')
        .forUpdate()
        .executeTakeFirst();

      if (!row) {
        return;
      }

      const event: DomainEvent = {
        id: row.id,
        tipo: row.tipo,
        agregado: row.agregado,
        ocurridoEn: row.creado_en,
        payload: (row.payload as Record<string, unknown> | null) ?? {},
      };

      try {
        await this.dispatcher.dispatch(event, {
          notifications: new KyselyNotificationRepository(trx),
          audit: new KyselyAuditWriter(trx),
        });

        await trx
          .updateTable('evento_outbox')
          .set({ estado: 'procesada', procesado_en: new Date(), ultimo_error: null })
          .where('id', '=', id)
          .execute();
      } catch (error) {
        const attempts = row.intentos + 1;
        const exhausted = attempts >= env.OUTBOX_MAX_ATTEMPTS;
        const delayMs = Math.min(2 ** attempts * 1_000, 5 * 60 * 1_000);

        await trx
          .updateTable('evento_outbox')
          .set({
            estado: exhausted ? 'fallida' : 'pendiente',
            intentos: attempts,
            disponible_en: new Date(Date.now() + (exhausted ? 0 : delayMs)),
            procesado_en: exhausted ? new Date() : null,
            ultimo_error: safeCode(error),
          })
          .where('id', '=', id)
          .execute();
      }
    });
  }
}

function safeCode(error: unknown): string {
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && code.length > 0) {
    return code.slice(0, 120);
  }

  const name = (error as { name?: unknown }).name;
  return typeof name === 'string' ? name.slice(0, 120) : 'ERROR';
}
