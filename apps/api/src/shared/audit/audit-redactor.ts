import { createHash } from 'node:crypto';

import { emailHmac } from '../security/hmac.js';

/**
 * Reglas de redacción de auditoría (`modelo-auditoria-v1` §4).
 *
 * Falla cerrada: los campos sensibles conocidos nunca se copian; el email se
 * sustituye por su HMAC y el texto libre por metadatos. Si el payload supera
 * 8 KB se guarda un resumen con hash (AC-AUD-08/09).
 */

const PAYLOAD_LIMIT_BYTES = 8 * 1024;
const MAX_DEPTH = 8;

const SECRET_KEYS = new Set([
  'password',
  'password_hash',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'code',
  'codigo',
  'totp',
  'token',
  'accesstoken',
  'refreshtoken',
  'csrftoken',
  'sessiontoken',
  'codigo_hash',
  'codigohash',
  'mfa_secret',
  'mfa_secret_cifrado',
  'mfasecret',
  'mfasecretcifrado',
  'secret',
  'numerodocumento',
  'numero_documento',
  'documento',
  'telefono',
  'direccion',
  // Emisora R.A.C. (plan §4.3): PII cifrada de realizadores e índice ciego.
  'numerodocumentocifrado',
  'numero_documento_cifrado',
  'numerodocumentohash',
  'numero_documento_hash',
  'contactocifrado',
  'contacto_cifrado',
  'consentimientodatos',
  'consentimiento_datos',
]);

const FREE_TEXT_KEYS = new Set(['observacion', 'observaciones', 'justificacion_texto']);

function initials(value: string): string {
  return value
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((part) => [...part][0]?.toUpperCase() ?? '')
    .join('');
}

export class AuditRedactor {
  redact(value: unknown): unknown {
    return this.truncate(this.sanitize(value, 0));
  }

  private sanitize(value: unknown, depth: number): unknown {
    if (value === null || value === undefined) {
      return value ?? null;
    }

    if (depth > MAX_DEPTH) {
      return '[profundidad excedida]';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item, depth + 1));
    }

    if (typeof value === 'object') {
      const output: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        const normalized = key.toLowerCase();
        if (SECRET_KEYS.has(normalized)) {
          output[key] = { cambiado: true };
          continue;
        }
        if (normalized === 'email') {
          output[key] = { email_hmac: emailHmac(String(nested)) };
          continue;
        }
        if (FREE_TEXT_KEYS.has(normalized)) {
          output[key] = {
            cambiado: true,
            longitud: typeof nested === 'string' ? [...nested].length : 0,
          };
          continue;
        }
        if (
          (normalized === 'nombres' || normalized === 'apellidos') &&
          typeof nested === 'string'
        ) {
          output[key] = initials(nested);
          continue;
        }
        output[key] = this.sanitize(nested, depth + 1);
      }
      return output;
    }

    return value;
  }

  private truncate(payload: unknown): unknown {
    const serialized = JSON.stringify(payload ?? null);
    if (Buffer.byteLength(serialized, 'utf8') <= PAYLOAD_LIMIT_BYTES) {
      return payload;
    }

    const hash = createHash('sha256').update(serialized, 'utf8').digest('hex');
    const fields = payload && typeof payload === 'object' ? Object.keys(payload).length : 0;
    return {
      resumen: 'payload_truncado',
      hash_sha256: hash,
      campos: fields,
    };
  }
}
