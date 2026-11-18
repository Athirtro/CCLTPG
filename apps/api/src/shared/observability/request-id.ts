import { v7 as uuidv7 } from 'uuid';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Acepta el `X-Request-Id` entrante solo si es un UUID válido y corto;
 * en cualquier otro caso genera un UUIDv7. Evita inyección de cabeceras y
 * mantiene la correlación entre logs, trazas y respuestas de error.
 */
export function resolveRequestId(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header;

  if (typeof candidate === 'string' && candidate.length <= 64 && UUID_PATTERN.test(candidate)) {
    return candidate;
  }

  return uuidv7();
}
