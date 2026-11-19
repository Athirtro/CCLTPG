import type { Request } from 'express';
import { HttpException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';

import type { AuthPrincipal } from '../../src/shared/auth/auth-principal.js';
import { AuditController } from '../../src/modules/audit/api/audit.controller.js';
import { AuditQueryDto } from '../../src/modules/audit/api/dto/audit-query.dto.js';
import type { AuditService } from '../../src/modules/audit/application/audit.service.js';

/**
 * AC-AUD-11: los filtros fuera de rango responden 400 (validación del DTO y
 * rango de fechas), y solo `audit:event:read` alcanza la operación (esa parte
 * la cubre la matriz de autorización contract-driven).
 */

async function errorsOf(query: Record<string, unknown>): Promise<string[]> {
  const instance = plainToInstance(AuditQueryDto, query);
  const errors = await validate(instance, {
    forbidUnknownValues: true,
    whitelist: true,
  });
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

const principal: AuthPrincipal = {
  userId: '0190f000-0000-7000-8000-000000000001',
  sid: 'sid',
  jti: 'jti',
  amr: ['pwd'],
  email: 'admin@ccltpg.org',
  nombre: 'Administrador',
  estado: 'activo',
  mfaEnabled: true,
  mustChangePassword: false,
  profiles: [{ id: 'perfil', codigo: 'administrador', nombre: 'Administrador', validUntil: null }],
  permissions: ['audit:event:read'],
  grants: [],
  actorProfile: 'administrador',
  activeProfile: 'administrador',
  accessTokenExpiresAt: new Date(Date.now() + 900_000),
};

function request(auth: AuthPrincipal = principal): Request & { auth?: AuthPrincipal } {
  return {
    id: 'req-auditoria',
    headers: { 'user-agent': 'vitest' },
    auth,
  } as unknown as Request & { auth?: AuthPrincipal };
}

describe('consulta de auditoría (AC-AUD-11/12)', () => {
  it('acepta filtros dentro de rango', async () => {
    await expect(
      errorsOf({
        limit: 50,
        offset: 0,
        accion: 'usuario.creado',
        recurso: 'usuario',
      }),
    ).resolves.toEqual([]);
  });

  it('rechaza límites, offsets y formatos fuera de rango', async () => {
    for (const query of [
      { limit: 0 },
      { limit: 201 },
      { limit: 'muchos' },
      { offset: -1 },
      { accion: 'usuario' },
      { accion: 'Usuario.Creado' },
      { recurso: 'usuario.creado' },
      { from: 'ayer' },
      { actorId: 'no-es-uuid' },
    ]) {
      const errors = await errorsOf(query);
      expect(errors.length, `query ${JSON.stringify(query)}`).toBeGreaterThan(0);
    }
  });

  it('rechaza un rango de fechas invertido con 400', async () => {
    const query = vi.fn();
    const service = { query } as unknown as AuditService;
    const controller = new AuditController(service);

    const failure = await controller
      .list(
        {
          from: '2026-11-18T00:00:00.000Z',
          to: '2026-11-17T00:00:00.000Z',
          limit: 50,
          offset: 0,
        },
        request(),
      )
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(failure).toBeInstanceOf(HttpException);
    expect((failure as HttpException).getStatus()).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('delega la consulta con el contexto de la solicitud', async () => {
    const page = { items: [], total: 0 };
    const query = vi.fn().mockResolvedValue(page);
    const service = { query } as unknown as AuditService;
    const controller = new AuditController(service);

    await expect(
      controller.list({ accion: 'usuario.creado', limit: 10, offset: 0 }, request()),
    ).resolves.toMatchObject({ items: [], total: 0, limit: 10, offset: 0 });

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'usuario.creado', limit: 10, offset: 0 }),
      principal,
      expect.objectContaining({ requestId: 'req-auditoria', userAgent: 'vitest' }),
    );
  });
});
