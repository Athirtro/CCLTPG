import type { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';

import type { AuthPrincipal } from '../../src/shared/auth/auth-principal.js';
import { IdentityController } from '../../src/modules/identity/api/identity.controller.js';
import {
  AssignProfileDto,
  CreateUserDto,
  TransitionDto,
  UpdateUserDto,
} from '../../src/modules/identity/api/dto/auth.dto.js';
import { ListUsersQueryDto } from '../../src/modules/identity/api/dto/auth-response.dto.js';
import type { IdentityAdminService } from '../../src/modules/identity/application/identity-admin.service.js';

/**
 * Las cinco operaciones administrativas (OP-06…OP-10) delegan en
 * `IdentityAdminService` y devuelven solo la proyección pública. La matriz de
 * autorización se comprueba de forma contract-driven en `authorization-matrix`.
 */

const principal: AuthPrincipal = {
  userId: '0190f000-0000-7000-8000-000000000001',
  sid: 'sid',
  jti: 'jti',
  amr: ['pwd', 'otp'],
  email: 'admin@ccltpg.org',
  nombre: 'Administrador E2E',
  estado: 'activo',
  mfaEnabled: true,
  mustChangePassword: false,
  profiles: [{ id: 'perfil', codigo: 'administrador', nombre: 'Administrador', validUntil: null }],
  permissions: ['identity:user:manage'],
  grants: [],
  actorProfile: 'administrador',
  activeProfile: 'administrador',
  accessTokenExpiresAt: new Date(Date.now() + 900_000),
};

const usuario = {
  id: '0190f000-0000-7000-8000-000000000002',
  email: 'gestion@ccltpg.org',
  nombre: 'Usuario Gestión',
  estado: 'activo' as const,
  mfaHabilitado: false,
  debeCambiarPassword: true,
  creadoEn: new Date('2026-11-20T10:00:00.000Z'),
  actualizadoEn: new Date('2026-11-21T11:00:00.000Z'),
};

function request(): Request & { auth?: AuthPrincipal } {
  return {
    id: 'req-identidad',
    headers: { 'user-agent': 'vitest' },
    auth: principal,
  } as unknown as Request & { auth?: AuthPrincipal };
}

function controllerCon(admin: Record<string, unknown>): IdentityController {
  return new IdentityController(admin as unknown as IdentityAdminService);
}

describe('administración de identidad (OP-06…OP-10)', () => {
  it('lista con filtros, paginación y contexto de solicitud', async () => {
    const list = vi.fn().mockResolvedValue({ items: [usuario], total: 1 });
    const controller = controllerCon({ list });
    const query: ListUsersQueryDto = {
      search: 'gestion',
      estado: 'activo',
      limit: 10,
      offset: 5,
    };

    await expect(controller.list(query, request())).resolves.toEqual({
      items: [usuario],
      total: 1,
      limit: 10,
      offset: 5,
    });

    expect(list).toHaveBeenCalledWith(
      { search: 'gestion', estado: 'activo', limit: 10, offset: 5 },
      principal,
      expect.objectContaining({ requestId: 'req-identidad', userAgent: 'vitest' }),
    );
  });

  it('crea convirtiendo la vigencia del perfil y sin exponer secretos', async () => {
    const create = vi.fn().mockResolvedValue(usuario);
    const controller = controllerCon({ create });
    const dto: CreateUserDto = {
      email: 'gestion@ccltpg.org',
      nombre: 'Usuario Gestión',
      password: 'ClaveSegura#2026',
      estado: 'activo',
      profiles: [{ codigo: 'estudiante', validUntil: '2027-01-01T00:00:00.000Z' }],
    };

    const resultado = await controller.create(dto, request());

    expect(create).toHaveBeenCalledWith(
      {
        email: dto.email,
        nombre: dto.nombre,
        password: dto.password,
        estado: 'activo',
        profiles: [{ codigo: 'estudiante', validUntil: new Date('2027-01-01T00:00:00.000Z') }],
      },
      principal,
      expect.objectContaining({ requestId: 'req-identidad' }),
    );
    expect(resultado).toEqual(usuario);
    expect(resultado).not.toHaveProperty('passwordHash');
    expect(resultado).not.toHaveProperty('mfaSecretCifrado');
  });

  it('actualiza nombre, contraseña y MFA con el identificador de la ruta', async () => {
    const update = vi.fn().mockResolvedValue(usuario);
    const controller = controllerCon({ update });
    const dto: UpdateUserDto = {
      nombre: 'Usuario Gestión',
      password: 'ClaveSegura#2026',
      resetMfa: true,
    };

    await expect(controller.update(usuario.id, dto, request())).resolves.toEqual(usuario);

    expect(update).toHaveBeenCalledWith(
      usuario.id,
      dto,
      principal,
      expect.objectContaining({ requestId: 'req-identidad' }),
    );
  });

  it('transiciona el estado con el motivo opcional', async () => {
    const transition = vi.fn().mockResolvedValue({ ...usuario, estado: 'bloqueado' });
    const controller = controllerCon({ transition });
    const dto: TransitionDto = { to: 'bloqueado', motivo: 'Prueba administrativa' };

    await expect(controller.transition(usuario.id, dto, request())).resolves.toMatchObject({
      estado: 'bloqueado',
    });

    expect(transition).toHaveBeenCalledWith(
      usuario.id,
      'bloqueado',
      'Prueba administrativa',
      principal,
      expect.objectContaining({ requestId: 'req-identidad' }),
    );
  });

  it('asigna perfiles y responde solo con ok', async () => {
    const assignProfile = vi.fn().mockResolvedValue(undefined);
    const controller = controllerCon({ assignProfile });
    const dto: AssignProfileDto = {
      codigo: 'educador',
      validUntil: '2027-06-01T00:00:00.000Z',
    };

    await expect(controller.assignProfile(usuario.id, dto, request())).resolves.toEqual({
      ok: true,
    });

    expect(assignProfile).toHaveBeenCalledWith(
      usuario.id,
      'educador',
      new Date('2027-06-01T00:00:00.000Z'),
      principal,
      expect.objectContaining({ requestId: 'req-identidad' }),
    );
  });
});

describe('validación de cuerpos y filtros de administración de identidad', () => {
  const opciones = { forbidUnknownValues: true, whitelist: true };

  it('acepta cuerpos válidos', async () => {
    const casos = [
      plainToInstance(CreateUserDto, {
        email: 'gestion@ccltpg.org',
        nombre: 'Usuario Gestión',
        password: 'ClaveSegura#2026',
        profiles: [{ codigo: 'estudiante' }],
      }),
      plainToInstance(UpdateUserDto, { nombre: 'Otro nombre', resetMfa: true }),
      plainToInstance(TransitionDto, { to: 'inactivo' }),
      plainToInstance(AssignProfileDto, { codigo: 'educador' }),
      plainToInstance(ListUsersQueryDto, { limit: 10, offset: 0, estado: 'activo' }),
    ];

    for (const caso of casos) {
      await expect(validate(caso, opciones)).resolves.toEqual([]);
    }
  });

  it('rechaza correo, contraseña, estados y fechas inválidos', async () => {
    const casos = [
      plainToInstance(CreateUserDto, {
        email: 'no-es-correo',
        nombre: 'Usuario Gestión',
        password: 'corta',
        profiles: [],
      }),
      plainToInstance(UpdateUserDto, { password: 'corta' }),
      plainToInstance(TransitionDto, { to: 'archivado' }),
      plainToInstance(AssignProfileDto, { codigo: 'educador', validUntil: 'ayer' }),
      plainToInstance(ListUsersQueryDto, { limit: 0, offset: -1, estado: 'desconocido' }),
    ];

    for (const caso of casos) {
      expect((await validate(caso, opciones)).length).toBeGreaterThan(0);
    }
  });
});
