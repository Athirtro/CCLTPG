import { describe, expect, it } from 'vitest';

import { AuditRedactor } from './audit-redactor.js';

describe('redacción de auditoría', () => {
  const redactor = new AuditRedactor();

  it('sustituye secretos conocidos sin copiar su valor', () => {
    const result = redactor.redact({
      password: 'Secreta#12345',
      accessToken: 'eyJhbGciOi...',
      mfa_secret_cifrado: 'v1.abc.def',
      nombre: 'Ana',
    }) as Record<string, unknown>;

    expect(result.password).toEqual({ cambiado: true });
    expect(result.accessToken).toEqual({ cambiado: true });
    expect(result.mfa_secret_cifrado).toEqual({ cambiado: true });
    expect(JSON.stringify(result)).not.toContain('Secreta#12345');
    expect(result.nombre).toBe('Ana');
  });

  it('reemplaza el email por su HMAC determinista', () => {
    const first = redactor.redact({ email: 'Persona@CCLTPG.org' }) as {
      email: { email_hmac: string };
    };
    const second = redactor.redact({ email: 'persona@ccltpg.org' }) as {
      email: { email_hmac: string };
    };

    expect(first.email.email_hmac).toMatch(/^[0-9a-f]{16}$/u);
    expect(second.email.email_hmac).toBe(first.email.email_hmac);
    expect(JSON.stringify(first)).not.toContain('persona@ccltpg.org');
  });

  it('reduce texto libre a metadatos y trunca payloads de más de 8 KB', () => {
    const freeText = redactor.redact({
      observacion: 'x'.repeat(9_000),
    }) as { observacion: { cambiado: boolean; longitud: number } };
    expect(freeText.observacion).toEqual({ cambiado: true, longitud: 9_000 });

    const oversized = redactor.redact({ detalle: 'a'.repeat(9_000) }) as {
      resumen: string;
      hash_sha256: string;
      campos: number;
    };
    expect(oversized.resumen).toBe('payload_truncado');
    expect(oversized.hash_sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(oversized.campos).toBe(1);
  });

  it('corta la recursión en estructuras demasiado profundas', () => {
    let value: unknown = 'fin';
    for (let index = 0; index < 12; index += 1) {
      value = { nested: value };
    }

    expect(JSON.stringify(redactor.redact(value))).toContain('profundidad excedida');
  });
});
