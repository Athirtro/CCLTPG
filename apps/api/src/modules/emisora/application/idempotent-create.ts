import { env } from '../../../shared/config/env.js';
import { canonicalJson, sha256Hex } from '../../../shared/idempotency/canonical-hash.js';
import type { IdempotencyStore } from '../../../shared/idempotency/idempotency.port.js';
import { EmisoraError } from './emisora-error.js';

export interface IdempotentCreationInput {
  store: IdempotencyStore;
  usuarioId: string;
  operacion: string;
  clave: string | null;
  cuerpo: unknown;
}

/**
 * Envoltorio de creación idempotente de la emisora (plan §6.5). Usa la tienda
 * compartida `public.idempotency_key`; emisora no consulta ese esquema.
 */
export async function runIdempotentCreate<T>(
  input: IdempotentCreationInput,
  action: () => Promise<T>,
): Promise<T> {
  const clave = input.clave?.trim();
  if (!clave) {
    throw EmisoraError.idempotencyKeyRequired();
  }

  const hashSolicitud = sha256Hex(
    canonicalJson({ operacion: input.operacion, cuerpo: input.cuerpo }),
  );
  const reservation = await input.store.reserve({
    usuarioId: input.usuarioId,
    operacion: input.operacion,
    clave,
    hashSolicitud,
    ttlSeconds: env.IDEMPOTENCY_TTL_SECONDS,
  });

  if (reservation.status === 'repetir') {
    return reservation.responseBody as T;
  }
  if (reservation.status === 'conflicto') {
    throw EmisoraError.idempotencyKeyReused();
  }
  if (reservation.status === 'en_proceso') {
    throw EmisoraError.idempotencyInProgress();
  }

  try {
    const result = await action();
    await input.store.complete(reservation.id, 201, result);
    return result;
  } catch (error) {
    await input.store.abandon(reservation.id).catch(() => undefined);
    throw error;
  }
}
