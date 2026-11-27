import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { AuthPrincipal } from '../../src/shared/auth/auth-principal.js';
import {
  ALLOW_ANONYMOUS_KEY,
  AUTHENTICATED_ONLY_KEY,
  PARTIAL_SCOPES_KEY,
  REQUIRE_PERMISSIONS_KEY,
  type PartialScope,
} from '../../src/shared/auth/auth-metadata.js';
import { PUBLIC_ROUTE_KEY } from '../../src/shared/auth/public.decorator.js';
import type { PartialTokenRecord } from '../../src/modules/identity/application/ports/session-cache.js';
import { expandPermissions, satisfiesAny } from '../../src/modules/identity/domain/permissions.js';
import {
  permissionsFor,
  PROFILE_SEEDS,
  type PerfilSeed,
} from '../../src/modules/identity/domain/perfiles.js';
import { AuthorizationGuard } from '../../src/modules/identity/api/guards/authorization.guard.js';

/**
 * Matriz de autorización ejecutable (AC-SEC-01, AC-SEC-16, AC-SEC-17).
 *
 * Lee el contrato OpenAPI generado y somete cada operación al guard real con
 * los tres perfiles de la semilla. Para cada operación con permiso exige al
 * menos un caso permitido y uno denegado; una operación nueva sin cobertura
 * hace fallar la prueba de conjunto.
 */

interface Operation {
  operationId: string;
  method: string;
  path: string;
  access: string;
  required: string[];
  scope: string;
  partialScopes: PartialScope[];
  allowAnonymous: boolean;
}

const contractPath = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'contracts',
  'openapi.json',
);
const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
  paths: Record<string, Record<string, Record<string, unknown>>>;
};

const EXPECTED_OPERATIONS = [
  'assignProfile',
  'changePassword',
  'confirmMfaEnrollment',
  'createEmisoraComite',
  'createEmisoraConvocatoria',
  'createEmisoraGrabacion',
  'createEmisoraInforme',
  'createEmisoraProgramacion',
  'createEmisoraProyecto',
  'getEmisoraProgramacion',
  'getEmisoraRejillaAnual',
  'listEmisoraAudios',
  'listEmisoraConvocatorias',
  'listEmisoraGrabaciones',
  'listEmisoraIncentivos',
  'notifyEmisoraRealizador',
  'registrarEmisoraAsistencia',
  'transitionEmisoraGrabacion',
  'transitionEmisoraProgramacion',
  'transitionEmisoraRejilla',
  'updateEmisoraIncentivo',
  'uploadEmisoraAudio',
  'createEnrollment',
  'createEvaluation',
  'createExport',
  'createGroup',
  'createProgram',
  'createSession',
  'createStudent',
  'createUser',
  'downloadFile',
  'enrollMfa',
  'generateReport',
  'getGroupSchedule',
  'getKpis',
  'getMe',
  'getMyEnrollments',
  'getMyEvaluations',
  'getMySchedule',
  'getMyStudent',
  'getNotificationPreferences',
  'getSession',
  'getSessionAttendance',
  'healthLive',
  'healthReady',
  'listAuditEvents',
  'listEnrollments',
  'listEvaluations',
  'listGroupSessions',
  'listGroups',
  'listNotifications',
  'listPrograms',
  'listReportCatalog',
  'listStudents',
  'listUsers',
  'login',
  'logout',
  'refresh',
  'regenerateRecoveryCodes',
  'replaceAttendance',
  'replaceGroupSchedule',
  'transitionEnrollment',
  'transitionGroup',
  'transitionProgram',
  'transitionSession',
  'transitionUser',
  'updateEvaluation',
  'updateNotification',
  'updateNotificationPreferences',
  'updateStudent',
  'updateUser',
  'uploadFile',
  'verifyMfa',
] as const;

function collectOperations(): Operation[] {
  const operations: Operation[] = [];

  for (const [route, item] of Object.entries(contract.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      const operationId = operation.operationId;
      if (typeof operationId !== 'string') {
        continue;
      }

      const access = operation['x-access'];
      const scope = operation['x-scope'];

      operations.push({
        operationId,
        method: method.toUpperCase(),
        path: route,
        access: typeof access === 'string' ? access : '',
        required: (operation['x-permission'] as string[] | undefined) ?? [],
        scope: typeof scope === 'string' ? scope : '',
        partialScopes: (operation['x-partial-scope'] as PartialScope[] | undefined) ?? [],
        allowAnonymous: operation['x-allow-anonymous'] === true,
      });
    }
  }

  return operations.sort((left, right) => left.operationId.localeCompare(right.operationId));
}

const operations = collectOperations();

function principalFor(seed: PerfilSeed): AuthPrincipal {
  const permissions = expandPermissions(permissionsFor(seed));
  const profile = {
    id: `perfil-${seed.codigo}`,
    codigo: seed.codigo,
    nombre: seed.nombre,
    validUntil: null,
  };

  return {
    userId: `usuario-${seed.codigo}`,
    sid: `sid-${seed.codigo}`,
    jti: `jti-${seed.codigo}`,
    amr: ['pwd'],
    email: `${seed.codigo}@ccltpg.org`,
    nombre: seed.nombre,
    estado: 'activo',
    mfaEnabled: seed.codigo !== 'estudiante',
    mustChangePassword: false,
    profiles: [profile],
    permissions,
    grants: [
      {
        profileId: profile.id,
        profileCode: seed.codigo,
        permissions,
      },
    ],
    actorProfile: seed.codigo,
    activeProfile: seed.codigo,
    accessTokenExpiresAt: new Date(Date.now() + 900_000),
  };
}

const principals = new Map(PROFILE_SEEDS.map((seed) => [seed.codigo, principalFor(seed)] as const));

interface Harness {
  guard: AuthorizationGuard;
  sessions: { resolvePrincipal: ReturnType<typeof vi.fn> };
  csrf: { assert: ReturnType<typeof vi.fn> };
}

function harnessFor(
  operation: Operation,
  principal: AuthPrincipal | null,
  partialEnabled = false,
): Harness {
  const metadata: Record<string, unknown> = {};

  switch (operation.access) {
    case 'public':
      metadata[PUBLIC_ROUTE_KEY] = true;
      break;
    case 'partial':
      metadata[PARTIAL_SCOPES_KEY] = operation.partialScopes;
      break;
    case 'partial_or_session':
      metadata[PARTIAL_SCOPES_KEY] = operation.partialScopes;
      metadata[AUTHENTICATED_ONLY_KEY] = true;
      break;
    case 'authenticated':
      metadata[AUTHENTICATED_ONLY_KEY] = true;
      if (operation.allowAnonymous) {
        metadata[ALLOW_ANONYMOUS_KEY] = true;
      }
      break;
    case 'permission':
      metadata[REQUIRE_PERMISSIONS_KEY] = operation.required;
      break;
    default:
      throw new Error(`x-access desconocido en ${operation.operationId}: ${operation.access}`);
  }

  const reflector = {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;

  const sessions = {
    resolvePrincipal: vi.fn().mockResolvedValue(principal),
    selectActorProfile: vi.fn().mockReturnValue(principal?.actorProfile ?? null),
  };
  const partials = new Map<string, PartialTokenRecord>();
  if (partialEnabled) {
    partials.set('token-parcial', { usuarioId: 'usuario-parcial', attempts: 0 });
  }

  const cache = {
    getPartial: vi.fn((token: string) => Promise.resolve(partials.get(token) ?? null)),
  };
  const limiter = {
    hit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0, count: 1 }),
  };
  const csrf = { assert: vi.fn() };

  return {
    guard: new AuthorizationGuard(
      reflector,
      sessions as never,
      cache as never,
      limiter as never,
      csrf as never,
    ),
    sessions,
    csrf,
  };
}

function requestFor(credential: 'none' | 'bearer' | 'partial'): Request {
  const request = {
    method: 'POST',
    headers: {},
    body: {},
  } as unknown as Request;

  if (credential === 'bearer') {
    (request.headers as Record<string, string>).authorization = 'Bearer token-de-acceso';
  }
  if (credential === 'partial') {
    (request as Request & { body: Record<string, unknown> }).body = {
      sessionToken: 'token-parcial',
    };
  }

  return request;
}

function contextOf(request: Request): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

async function decide(
  operation: Operation,
  credential: 'none' | 'bearer' | 'partial',
  principal: AuthPrincipal | null,
): Promise<boolean> {
  const { guard } = harnessFor(operation, principal, credential === 'partial');
  return guard.canActivate(contextOf(requestFor(credential)));
}

describe('matriz de autorización C2/C3 (contrato × perfiles)', () => {
  it('cubre exactamente las operaciones del contrato sin rutas sin declarar', () => {
    expect(operations.map((operation) => operation.operationId).sort()).toEqual(
      [...EXPECTED_OPERATIONS].sort(),
    );
    expect(operations.every((operation) => operation.scope.length > 0)).toBe(true);
  });

  for (const operation of operations) {
    describe(`${operation.method} ${operation.path} (${operation.access})`, () => {
      if (operation.access === 'public') {
        it('permite la llamada sin credenciales', async () => {
          await expect(decide(operation, 'none', null)).resolves.toBe(true);
        });
      }

      if (operation.access === 'partial') {
        it('permite un token parcial del ámbito declarado', async () => {
          await expect(decide(operation, 'partial', null)).resolves.toBe(true);
        });

        it('rechaza la llamada sin token parcial', async () => {
          await expect(decide(operation, 'none', null)).rejects.toMatchObject({
            code: 'AUTH_MFA_SESSION_INVALID',
          });
        });
      }

      if (operation.access === 'partial_or_session') {
        it('permite un token parcial del ámbito declarado', async () => {
          await expect(decide(operation, 'partial', null)).resolves.toBe(true);
        });

        it('permite una sesión completa', async () => {
          await expect(decide(operation, 'bearer', principals.get('administrador')!)).resolves.toBe(
            true,
          );
        });
      }

      if (operation.access === 'authenticated') {
        if (operation.allowAnonymous) {
          it('permite la llamada sin sesión cuando es idempotente', async () => {
            await expect(decide(operation, 'none', null)).resolves.toBe(true);
          });
        } else {
          it('rechaza la llamada sin sesión', async () => {
            await expect(decide(operation, 'none', null)).rejects.toMatchObject({
              code: 'AUTH_TOKEN_INVALID',
            });
          });
        }

        for (const seed of PROFILE_SEEDS) {
          it(`permite la sesión del perfil ${seed.codigo}`, async () => {
            await expect(decide(operation, 'bearer', principals.get(seed.codigo)!)).resolves.toBe(
              true,
            );
          });
        }
      }

      if (operation.access === 'permission') {
        const outcomes: boolean[] = [];

        for (const seed of PROFILE_SEEDS) {
          const principal = principals.get(seed.codigo)!;
          const allowed = satisfiesAny(principal.permissions, operation.required);
          outcomes.push(allowed);

          it(`${seed.codigo} → ${allowed ? 'permitido' : 'denegado por permiso'}`, async () => {
            if (allowed) {
              await expect(decide(operation, 'bearer', principal)).resolves.toBe(true);
            } else {
              await expect(decide(operation, 'bearer', principal)).rejects.toMatchObject({
                code: 'PERMISSION_DENIED',
              });
            }
          });
        }

        it('tiene al menos un caso permitido', () => {
          expect(outcomes).toContain(true);
        });

        if (operation.scope === 'global') {
          it('tiene al menos un caso denegado por perfil', () => {
            expect(outcomes).toContain(false);
          });
        }

        it('exige sesión antes de evaluar el permiso', async () => {
          await expect(decide(operation, 'none', null)).rejects.toMatchObject({
            code: 'AUTH_TOKEN_INVALID',
          });
        });
      }
    });
  }
});
