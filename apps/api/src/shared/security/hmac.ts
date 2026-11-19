import { createHmac } from 'node:crypto';

import { env } from '../config/env.js';

/**
 * HMAC-SHA256 con clave separada para el email en auditoría (AC-AUD-09).
 * Nunca se guarda el email en claro en `evento_auditoria`.
 */
export function hmacSha256Hex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex');
}

export function emailHmac(email: string): string {
  return hmacSha256Hex(env.EMAIL_HMAC_KEY, `email:${email.trim().toLowerCase()}`).slice(0, 16);
}
