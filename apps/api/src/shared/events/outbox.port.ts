/**
 * Eventos de dominio publicados por la outbox transaccional (D53).
 *
 * El productor escribe el evento en la misma transacción que el cambio y un
 * trabajador lo consume. `usuarioIds` declara los destinatarios previstos; el
 * consumidor de notificaciones sigue siendo quien aplica preferencias.
 */

export interface DomainEvent {
  id: string;
  tipo: string;
  agregado: string;
  ocurridoEn: Date;
  payload: Record<string, unknown>;
  usuarioIds?: string[];
}

export const OUTBOX_PORT = Symbol('CCLTPG_OUTBOX_PORT');

/** Escritor de outbox ligado al ejecutor transaccional del módulo. */
export interface OutboxPort {
  enqueue(event: DomainEvent): Promise<void>;
}
