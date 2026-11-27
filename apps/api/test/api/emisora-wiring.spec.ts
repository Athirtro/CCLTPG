import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { DATABASE, REDIS } from '../../src/database/database.module.js';
import {
  FORMACION_DIRECTORY,
  type FormacionDirectory,
} from '../../src/shared/integration/formacion-directory.port.js';
import { IDENTITY_DIRECTORY } from '../../src/shared/integration/identity-directory.port.js';
import {
  EMISORA_OWNERSHIP_POLICY,
  type EmisoraOwnershipPolicy,
} from '../../src/shared/integration/ownership.port.js';

/**
 * Evidencia de cableado (ADR-0005, decisión 3): emisora resuelve los puertos
 * de los contextos dueños mediante el puente de composición, sin importarlos. Si el
 * puente faltara, `compile()` no podría construir `IdentityOwnershipPolicy`.
 * Se compila `AppModule` con base y Redis simulados y se sustituye el
 * directorio de identidad para comprobar que la política lo consume.
 */

const fakeDatabase = {
  executeQuery: vi.fn(),
  getExecutor: () => ({
    transformQuery: (node: unknown) => node,
    compileQuery: (node: unknown) => ({ sql: 'select 1', parameters: [], query: node }),
    executeQuery: vi.fn(),
  }),
  destroy: vi.fn().mockResolvedValue(undefined),
};

const fakeRedis = {
  status: 'ready',
  ping: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
};

describe('cableado del contexto emisora', () => {
  let moduleRef: TestingModule;
  const findById = vi.fn(() =>
    Promise.resolve({
      id: 'u-propio',
      email: 'realizador@example.com',
      nombre: 'Realizador',
      estado: 'activo' as const,
      perfiles: [],
    }),
  );

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE)
      .useValue(fakeDatabase)
      .overrideProvider(REDIS)
      .useValue(fakeRedis)
      .overrideProvider(IDENTITY_DIRECTORY)
      .useValue({ findById })
      .compile();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resuelve también el directorio de formación desde el contexto dueño', () => {
    const formacion = moduleRef.get<FormacionDirectory>(FORMACION_DIRECTORY, { strict: false });
    expect(formacion).toBeDefined();
    expect(typeof formacion.listProgramas).toBe('function');
  });

  it('registra la política de propiedad inyectada desde el directorio de identidad', async () => {
    const policy = moduleRef.get<EmisoraOwnershipPolicy>(EMISORA_OWNERSHIP_POLICY, {
      strict: false,
    });

    await expect(policy.isOwner('u-propio', 'u-propio')).resolves.toBe(true);
    expect(findById).toHaveBeenCalledWith('u-propio');
  });
});
