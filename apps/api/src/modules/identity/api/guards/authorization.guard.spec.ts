import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { AuthPrincipal } from '../../../../shared/auth/auth-principal.js';
import {
  ALLOW_PASSWORD_CHANGE_KEY,
  AUTHENTICATED_ONLY_KEY,
  PARTIAL_SCOPES_KEY,
  REQUIRE_PERMISSIONS_KEY,
  type PartialScope,
} from '../../../../shared/auth/auth-metadata.js';
import { PUBLIC_ROUTE_KEY } from '../../../../shared/auth/public.decorator.js';
import type { PartialTokenRecord } from '../../application/ports/session-cache.js';
import { AuthorizationGuard } from './authorization.guard.js';

const principal: AuthPrincipal = {
  userId: '0190f000-0000-7000-8000-000000000001',
  sid: '0190f000-0000-7000-8000-000000000002',
  jti: '0190f000-0000-7000-8000-000000000003',
  amr: ['pwd', 'totp'],
  email: 'persona@ccltpg.org',
  nombre: 'Persona',
  estado: 'activo',
  mfaEnabled: true,
  mustChangePassword: false,
  profiles: [
    {
      id: '0190f000-0000-7000-8000-000000000004',
      codigo: 'administrador',
      nombre: 'Administrador',
      validUntil: null,
    },
  ],
  permissions: ['identity:user:manage', 'audit:event:read'],
  grants: [
    {
      profileId: '0190f000-0000-7000-8000-000000000004',
      profileCode: 'administrador',
      permissions: ['identity:user:manage', 'audit:event:read'],
    },
  ],
  actorProfile: 'administrador',
  activeProfile: 'administrador',
  accessTokenExpiresAt: new Date(Date.now() + 900_000),
};

interface Metadata {
  [key: string]: unknown;
}

function buildGuard(metadata: Metadata) {
  const reflector = {
    getAllAndOverride: (key: string, _targets: unknown[]) => metadata[key],
  } as unknown as Reflector;

  const sessions = {
    resolvePrincipal: vi.fn().mockResolvedValue({ ...principal }),
    selectActorProfile: vi.fn().mockReturnValue('administrador'),
  };
  const cache = {
    getPartial: vi.fn<(token: string, scope: PartialScope) => Promise<PartialTokenRecord | null>>(),
  };
  const limiter = {
    hit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0, count: 1 }),
  };
  const csrf = { assert: vi.fn() };

  const guard = new AuthorizationGuard(
    reflector,
    sessions as never,
    cache as never,
    limiter as never,
    csrf as never,
  );

  return { guard, sessions, cache, limiter, csrf };
}

function contextOf(request: Partial<Request> & { headers?: Record<string, unknown> }) {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthorizationGuard', () => {
  it('deniega por defecto una ruta sin metadatos', async () => {
    const { guard } = buildGuard({});
    const request = { method: 'GET', headers: { authorization: 'Bearer abc' } };

    await expect(guard.canActivate(contextOf(request))).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });

  it('exige credenciales cuando no hay token y la ruta no es pública', async () => {
    const { guard } = buildGuard({});
    const request = { method: 'GET', headers: {} };

    await expect(guard.canActivate(contextOf(request))).rejects.toMatchObject({
      code: 'AUTH_TOKEN_INVALID',
    });
  });

  it('permite rutas públicas sin evaluar sesión', async () => {
    const { guard, sessions } = buildGuard({ [PUBLIC_ROUTE_KEY]: true });

    await expect(guard.canActivate(contextOf({ method: 'POST', headers: {} }))).resolves.toBe(true);
    expect(sessions.resolvePrincipal).not.toHaveBeenCalled();
  });

  it('rechaza si falta el permiso declarado (semántica OR)', async () => {
    const { guard } = buildGuard({
      [REQUIRE_PERMISSIONS_KEY]: ['academic:program:manage'],
    });
    const request = { method: 'GET', headers: { authorization: 'Bearer abc' } };
    const allowed = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: ['audit:event:read'] });

    await expect(guard.canActivate(contextOf(request))).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    await expect(allowed.guard.canActivate(contextOf(request))).resolves.toBe(true);
  });

  it('bloquea todo salvo el cambio de contraseña cuando debe_cambiar_password', async () => {
    const { guard, sessions } = buildGuard({
      [REQUIRE_PERMISSIONS_KEY]: ['identity:user:manage'],
    });
    sessions.resolvePrincipal.mockResolvedValue({ ...principal, mustChangePassword: true });

    await expect(
      guard.canActivate(contextOf({ method: 'GET', headers: { authorization: 'Bearer abc' } })),
    ).rejects.toMatchObject({ code: 'AUTH_PASSWORD_CHANGE_REQUIRED' });

    const allowed = buildGuard({
      [AUTHENTICATED_ONLY_KEY]: true,
      [ALLOW_PASSWORD_CHANGE_KEY]: true,
    });
    allowed.sessions.resolvePrincipal.mockResolvedValue({
      ...principal,
      mustChangePassword: true,
    });

    await expect(
      allowed.guard.canActivate(
        contextOf({ method: 'POST', headers: { authorization: 'Bearer abc' } }),
      ),
    ).resolves.toBe(true);
    expect(allowed.csrf.assert).toHaveBeenCalled();
  });

  it('exige CSRF en métodos mutantes con sesión', async () => {
    const { guard, csrf } = buildGuard({ [AUTHENTICATED_ONLY_KEY]: true });
    csrf.assert.mockImplementation(() => {
      throw Object.assign(new Error('csrf'), { code: 'AUTH_CSRF_INVALID' });
    });

    await expect(
      guard.canActivate(contextOf({ method: 'POST', headers: { authorization: 'Bearer abc' } })),
    ).rejects.toMatchObject({ code: 'AUTH_CSRF_INVALID' });

    csrf.assert.mockReset();
    await expect(
      guard.canActivate(contextOf({ method: 'GET', headers: { authorization: 'Bearer abc' } })),
    ).resolves.toBe(true);
    expect(csrf.assert).not.toHaveBeenCalled();
  });

  it('acepta un token parcial solo dentro del ámbito declarado', async () => {
    const { guard, cache } = buildGuard({ [PARTIAL_SCOPES_KEY]: ['mfa_verify'] });
    cache.getPartial.mockResolvedValue({ usuarioId: principal.userId, attempts: 0 });

    const request = {
      method: 'POST',
      headers: {},
      body: { sessionToken: 'token-parcial-opaco' },
    };

    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
    expect(request).toHaveProperty('authPartial.scope', 'mfa_verify');

    cache.getPartial.mockResolvedValue(null);
    await expect(guard.canActivate(contextOf(request))).rejects.toMatchObject({
      code: 'AUTH_MFA_SESSION_INVALID',
    });
  });
});
