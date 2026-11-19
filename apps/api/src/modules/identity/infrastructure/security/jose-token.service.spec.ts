import { decodeJwt, decodeProtectedHeader, type JWTPayload } from 'jose';
import { describe, expect, it } from 'vitest';

import { env } from '../../../../shared/config/env.js';
import { JoseTokenService } from './jose-token.service.js';

const service = new JoseTokenService();

function claimsOf(token: string): JWTPayload {
  return decodeJwt(token);
}

describe('tokens de acceso JWT (AC-SEC-08)', () => {
  it('firma HS256 con kid y 900 segundos de vigencia', async () => {
    const { token, expiresIn } = await service.signAccess({
      sub: '0190f000-0000-7000-8000-000000000001',
      sid: '0190f000-0000-7000-8000-000000000002',
      jti: '0190f000-0000-7000-8000-000000000003',
      amr: ['pwd', 'totp'],
    });

    const header = decodeProtectedHeader(token);
    const claims = claimsOf(token);

    expect(header).toMatchObject({ alg: 'HS256', kid: env.JWT_KID_CURRENT });
    expect(expiresIn).toBe(900);
    expect(Number(claims.exp) - Number(claims.iat)).toBe(900);
    expect(claims).toMatchObject({
      sub: '0190f000-0000-7000-8000-000000000001',
      sid: '0190f000-0000-7000-8000-000000000002',
      jti: '0190f000-0000-7000-8000-000000000003',
      amr: ['pwd', 'totp'],
      typ: 'access',
    });
  });

  it('no incluye email, nombre, perfiles, permisos ni PII', async () => {
    const { token } = await service.signAccess({
      sub: '0190f000-0000-7000-8000-000000000001',
      sid: '0190f000-0000-7000-8000-000000000002',
      jti: '0190f000-0000-7000-8000-000000000003',
      amr: ['pwd'],
    });

    const serialized = JSON.stringify(claimsOf(token));
    for (const forbidden of ['email', 'nombre', 'perfiles', 'permissions', 'documento']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('valida la firma y rechaza un token manipulado', async () => {
    const { token } = await service.signAccess({
      sub: '0190f000-0000-7000-8000-000000000001',
      sid: '0190f000-0000-7000-8000-000000000002',
      jti: '0190f000-0000-7000-8000-000000000003',
      amr: ['pwd'],
    });

    await expect(service.verifyAccess(token)).resolves.toMatchObject({
      sub: '0190f000-0000-7000-8000-000000000001',
      amr: ['pwd'],
    });

    const [header, payload, signature] = token.split('.');
    const tamperedSignature = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
    const tampered = `${header}.${payload}.${tamperedSignature}`;

    await expect(service.verifyAccess(tampered)).rejects.toMatchObject({
      code: 'AUTH_TOKEN_INVALID',
    });
  });

  it('genera tokens opacos y códigos de recuperación de 10 caracteres', () => {
    expect(service.createOpaqueToken()).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(service.createRecoveryCode()).toMatch(/^[A-Z2-7]{10}$/u);
    expect(service.hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
