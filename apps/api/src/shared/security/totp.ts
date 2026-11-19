import { createHmac, timingSafeEqual } from 'node:crypto';

import { base32Decode } from './base32.js';

/**
 * TOTP RFC 6238 (SHA-1, 6 dígitos, paso de 30 s) con ventana ±1.
 * La verificación usa comparación en tiempo constante.
 */
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;

function hotp(secret: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', secret).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

export function generateTotp(secret: string, at: Date = new Date()): string {
  const key = Buffer.from(base32Decode(secret));
  return hotp(key, Math.floor(at.getTime() / 1000 / TOTP_PERIOD_SECONDS));
}

/** Verifica el código aceptando el paso actual y ±1 (tolerancia de reloj). */
export function verifyTotp(
  secret: string,
  code: string,
  at: Date = new Date(),
  window = 1,
): boolean {
  const candidate = code.replace(/\s+/gu, '');
  if (!/^\d{6}$/u.test(candidate)) {
    return false;
  }

  const key = Buffer.from(base32Decode(secret));
  const counter = Math.floor(at.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  const expected = Buffer.from(candidate);

  for (let delta = -window; delta <= window; delta += 1) {
    const computed = Buffer.from(hotp(key, counter + delta));
    if (computed.length === expected.length && timingSafeEqual(computed, expected)) {
      return true;
    }
  }

  return false;
}
