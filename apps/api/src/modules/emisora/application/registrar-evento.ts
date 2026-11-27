import { v7 as uuidv7 } from 'uuid';

import type { ActorContext } from './emisora.types.js';
import type { EmisoraTransactionContext } from './ports/unit-of-work.js';

export interface EventoEmisora {
  tipo: string;
  payload: Record<string, unknown>;
  usuarioIds?: string[];
}

/**
 * Escribe auditoría y outbox con el mismo ejecutor transaccional (ADR-0004 y
 * ADR-0005). `accion` es el nombre legible de auditoría; `eventos` son los
 * nombres del catálogo emisora que además se publican al worker.
 */
export async function registrarEvento(
  tx: EmisoraTransactionContext,
  input: {
    accion: string;
    recurso: string;
    recursoId: string;
    actor: ActorContext;
    datosAntes?: unknown;
    datosDespues?: unknown;
    eventos: readonly EventoEmisora[];
  },
): Promise<void> {
  await tx.audit.record({
    accion: input.accion,
    recurso: input.recurso,
    recursoId: input.recursoId,
    actorId: input.actor.userId,
    actorPerfil: input.actor.actorProfile,
    ip: input.actor.ip,
    dispositivo: input.actor.userAgent,
    datosAntes: input.datosAntes,
    datosDespues: input.datosDespues,
    requestId: input.actor.requestId,
  });

  for (const evento of input.eventos) {
    await tx.outbox.enqueue({
      id: uuidv7(),
      tipo: evento.tipo,
      agregado: input.recurso,
      ocurridoEn: new Date(),
      payload: evento.payload,
      ...(evento.usuarioIds ? { usuarioIds: evento.usuarioIds } : {}),
    });
  }
}
