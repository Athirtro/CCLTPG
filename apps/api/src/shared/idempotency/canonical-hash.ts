import { createHash } from 'node:crypto';

/** SHA-256 en hexadecimal minúscula. */
export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Serialización JSON canónica: claves ordenadas, sin espacios y con `Date`
 * normalizado a ISO. Dos cuerpos semánticamente iguales producen el mismo hash.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      result[key] = normalize(record[key]);
    }
    return result;
  }

  return value;
}
