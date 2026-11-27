import type { Request } from 'express';

import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import { buildRequestContext } from '../../../shared/http/request-context.js';
import type { ActorContext } from '../application/emisora.types.js';

export type AuthenticatedRequest = Request & { auth?: AuthPrincipal };

/** Traduce la solicitud autenticada al contexto de auditoría de la emisora. */
export function actorOf(request: AuthenticatedRequest): ActorContext {
  const actor = request.auth!;
  const context = buildRequestContext(request);
  return {
    userId: actor.userId,
    actorProfile: actor.actorProfile,
    permissions: actor.permissions,
    ip: context.ip,
    userAgent: context.userAgent,
    requestId: context.requestId,
  };
}
