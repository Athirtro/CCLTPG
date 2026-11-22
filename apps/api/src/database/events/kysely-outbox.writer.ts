import type { Kysely, Transaction } from 'kysely';

import type { Database } from '../schema.js';
import type { DomainEvent, OutboxPort } from '../../shared/events/outbox.port.js';

type Executor = Kysely<Database> | Transaction<Database>;

/**
 * Escritor de outbox ligado a una transacción (D53).
 *
 * Se construye con el mismo ejecutor que el cambio de negocio; si la
 * transacción se revierte, el evento tampoco se publica.
 */
export class KyselyOutboxWriter implements OutboxPort {
  constructor(private readonly db: Executor) {}

  async enqueue(event: DomainEvent): Promise<void> {
    await this.db
      .insertInto('evento_outbox')
      .values({
        id: event.id,
        agregado: event.agregado,
        tipo: event.tipo,
        payload: {
          ...event.payload,
          usuarioIds: event.usuarioIds ?? [],
          ocurridoEn: event.ocurridoEn.toISOString(),
        },
        estado: 'pendiente',
        intentos: 0,
        disponible_en: event.ocurridoEn,
        procesado_en: null,
        ultimo_error: null,
      })
      .execute();
  }
}
