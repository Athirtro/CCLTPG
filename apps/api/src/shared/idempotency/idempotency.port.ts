/**
 * Puerto de idempotencia (AC-SEC-30, C-38, D57).
 *
 * La reserva se hace antes de ejecutar el efecto secundario. Una repetición
 * exacta devuelve la respuesta original; un cuerpo distinto con la misma clave
 * es un conflicto estable.
 */

export const IDEMPOTENCY_STORE = Symbol('CCLTPG_IDEMPOTENCY_STORE');

export interface ReserveIdempotencyInput {
  usuarioId: string;
  operacion: string;
  clave: string;
  hashSolicitud: string;
  ttlSeconds: number;
}

export type IdempotencyReservation =
  | { status: 'nuevo'; id: string }
  | { status: 'repetir'; responseStatus: number; responseBody: unknown }
  | { status: 'conflicto' }
  | { status: 'en_proceso' };

export interface IdempotencyStore {
  reserve(input: ReserveIdempotencyInput): Promise<IdempotencyReservation>;
  complete(id: string, responseStatus: number, responseBody: unknown): Promise<void>;
  abandon(id: string): Promise<void>;
  purgeExpired(now: Date): Promise<number>;
}
