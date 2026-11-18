/**
 * Extrae el `requestId` que pino-http adjunta a la solicitud.
 * Express 5 tipa `req.id` como `ReqId`, por eso se comprueba en tiempo de ejecución.
 */
export function getRequestId(request: { id?: unknown }): string | null {
  return typeof request.id === 'string' ? request.id : null;
}
