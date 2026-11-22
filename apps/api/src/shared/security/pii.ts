import { env } from '../config/env.js';
import { decryptField, encryptField } from './encryption.js';
import { hmacSha256Hex } from './hmac.js';

/**
 * Protección de PII académica (D61, AC-SEC-25).
 *
 * - Cifrado AES-256-GCM con AAD específico por estudiante y campo.
 * - Índice ciego HMAC-SHA256 con clave separada para buscar por documento.
 * - Nunca se expone el documento en listados, auditoría ni errores.
 */

export const PII_FIELDS = ['numero_documento', 'direccion', 'telefono'] as const;

export type PiiField = (typeof PII_FIELDS)[number];

export function piiAad(estudianteId: string, field: PiiField): string {
  return `estudiante:${estudianteId}:${field}`;
}

export function encryptPii(estudianteId: string, field: PiiField, value: string): string {
  return encryptField(value, piiAad(estudianteId, field), env.PII_ENCRYPTION_KEY);
}

export function decryptPii(estudianteId: string, field: PiiField, value: string): string {
  return decryptField(value, piiAad(estudianteId, field), env.PII_ENCRYPTION_KEY);
}

/**
 * Normaliza el documento antes de calcular el índice ciego. El valor original
 * se conserva cifrado; la normalización solo afecta a la búsqueda exacta.
 */
export function normalizeDocument(tipoDocumento: string, numeroDocumento: string): string {
  return `${tipoDocumento.trim().toLowerCase()}:${numeroDocumento.replace(/\s+/gu, '').toUpperCase()}`;
}

export function documentHmac(tipoDocumento: string, numeroDocumento: string): string {
  return hmacSha256Hex(
    env.PII_HMAC_KEY,
    `documento:${normalizeDocument(tipoDocumento, numeroDocumento)}`,
  );
}
