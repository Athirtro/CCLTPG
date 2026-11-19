import { describe, expect, it } from 'vitest';

import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import { MeService } from './me.service.js';

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
      codigo: 'estudiante',
      nombre: 'Estudiante',
      validUntil: null,
    },
    {
      id: '0190f000-0000-7000-8000-000000000005',
      codigo: 'educador',
      nombre: 'Educador',
      validUntil: new Date('2026-12-31T00:00:00.000Z'),
    },
  ],
  permissions: ['academic:evaluation:read_own', 'identity:user:manage'],
  grants: [
    {
      profileId: '0190f000-0000-7000-8000-000000000005',
      profileCode: 'educador',
      permissions: ['identity:user:manage'],
    },
  ],
  actorProfile: 'educador',
  activeProfile: 'educador',
  accessTokenExpiresAt: new Date('2026-11-18T00:15:00.000Z'),
};

describe('/me (AC-SEC-22)', () => {
  it('devuelve solo datos calculados en el servidor y perfiles ordenados', () => {
    const body = new MeService().build(principal);

    expect(body).toMatchObject({
      userId: principal.userId,
      email: principal.email,
      mfaEnabled: true,
      mustChangePassword: false,
      activeProfile: 'educador',
      permissions: principal.permissions,
    });
    expect(body.profiles.map((profile) => profile.codigo)).toEqual(['educador', 'estudiante']);
  });

  it('no incluye wildcards ni datos internos de sesión', () => {
    const body = new MeService().build(principal);

    expect(body.permissions.some((permission) => permission.includes('*'))).toBe(false);
    expect(JSON.stringify(body)).not.toContain('sid');
    expect(JSON.stringify(body)).not.toContain('jti');
  });
});
