import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { env } from '../config/env.js';

/**
 * Cifrado de campos sensibles con AES-256-GCM y datos asociados (AAD).
 * Formato versionado: `v1.<iv>.<tag>.<ciphertext>` en base64url.
 */

const VERSION = 'v1';
const IV_BYTES = 12;

function keyFromSecret(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptField(
  plaintext: string,
  aad: string,
  secret = env.MFA_ENCRYPTION_KEY,
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptField(
  payload: string,
  aad: string,
  secret = env.MFA_ENCRYPTION_KEY,
): string {
  const [version, iv, tag, ciphertext] = payload.split('.');
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Formato de campo cifrado inválido');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyFromSecret(secret),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function mfaAad(usuarioId: string): string {
  return `mfa:usuario:${usuarioId}`;
}
