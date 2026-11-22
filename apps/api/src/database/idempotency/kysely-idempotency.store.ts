import type { Kysely } from 'kysely';
import { v7 as uuidv7 } from 'uuid';

import type { Database } from '../schema.js';
import type {
  IdempotencyReservation,
  IdempotencyStore,
  ReserveIdempotencyInput,
} from '../../shared/idempotency/idempotency.port.js';

/**
 * Implementación PostgreSQL de la idempotencia (R-032).
 *
 * La unicidad `(usuario_id, operacion, clave)` es la que resuelve la carrera:
 * dos solicitudes concurrentes no pueden ejecutar el efecto dos veces.
 */
export class KyselyIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db: Kysely<Database>) {}

  async reserve(input: ReserveIdempotencyInput): Promise<IdempotencyReservation> {
    const id = uuidv7();
    const expiraEn = new Date(Date.now() + input.ttlSeconds * 1000);

    try {
      await this.db
        .insertInto('idempotency_key')
        .values({
          id,
          usuario_id: input.usuarioId,
          operacion: input.operacion,
          clave: input.clave,
          hash_solicitud: input.hashSolicitud,
          estado: 'en_proceso',
          respuesta_status: null,
          respuesta_cuerpo: null,
          expira_en: expiraEn,
        })
        .execute();

      return { status: 'nuevo', id };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }

    const existing = await this.db
      .selectFrom('idempotency_key')
      .selectAll()
      .where('usuario_id', '=', input.usuarioId)
      .where('operacion', '=', input.operacion)
      .where('clave', '=', input.clave)
      .executeTakeFirst();

    if (!existing) {
      throw new Error('Conflicto de idempotencia sin fila recuperable.');
    }

    if (existing.expira_en.getTime() <= Date.now()) {
      await this.db.deleteFrom('idempotency_key').where('id', '=', existing.id).execute();
      return this.reserve(input);
    }

    if (existing.hash_solicitud !== input.hashSolicitud) {
      return { status: 'conflicto' };
    }

    if (existing.estado === 'completada' && existing.respuesta_status !== null) {
      return {
        status: 'repetir',
        responseStatus: existing.respuesta_status,
        responseBody: existing.respuesta_cuerpo,
      };
    }

    return { status: 'en_proceso' };
  }

  async complete(id: string, responseStatus: number, responseBody: unknown): Promise<void> {
    await this.db
      .updateTable('idempotency_key')
      .set({
        estado: 'completada',
        respuesta_status: responseStatus,
        respuesta_cuerpo: responseBody as never,
      })
      .where('id', '=', id)
      .execute();
  }

  async abandon(id: string): Promise<void> {
    await this.db.deleteFrom('idempotency_key').where('id', '=', id).execute();
  }

  async purgeExpired(now: Date): Promise<number> {
    const result = await this.db
      .deleteFrom('idempotency_key')
      .where('expira_en', '<', now)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === '23505';
}
