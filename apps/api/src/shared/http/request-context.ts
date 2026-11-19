/** Contexto de red y correlación de una solicitud. */
export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export function buildRequestContext(request: {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
  id?: unknown;
}): RequestContext {
  const agent = request.headers['user-agent'];
  const requestId = typeof request.id === 'string' ? request.id : null;

  return {
    ip: request.ip ?? request.socket?.remoteAddress ?? null,
    userAgent: (Array.isArray(agent) ? agent[0] : agent) ?? null,
    requestId,
  };
}
