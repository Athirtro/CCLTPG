import { describe, expect, it, vi } from 'vitest';

import type {
  IdentityDirectory,
  IdentityUserRef,
} from '../../../shared/integration/identity-directory.port.js';
import { IdentityOwnershipPolicy } from './identity-ownership-policy.js';

/** Casos de la matriz emisora §4.1: propio, ajeno, sin dueño e inactivo. */
const ACTIVO: IdentityUserRef = {
  id: 'u-propio',
  email: 'realizador@example.com',
  nombre: 'Realizador',
  estado: 'activo',
  perfiles: [],
};

function policyWith(usuario: IdentityUserRef | null) {
  const findById = vi.fn(() => Promise.resolve(usuario));
  const identity = { findById } as unknown as IdentityDirectory;
  return { policy: new IdentityOwnershipPolicy(identity), findById };
}

describe('EmisoraOwnershipPolicy', () => {
  it('concede propiedad al usuario vigente sobre su propio recurso', async () => {
    const { policy, findById } = policyWith(ACTIVO);
    await expect(policy.isOwner('u-propio', 'u-propio')).resolves.toBe(true);
    expect(findById).toHaveBeenCalledWith('u-propio');
  });

  it('niega un recurso ajeno sin consultar la identidad del otro usuario', async () => {
    const { policy, findById } = policyWith(ACTIVO);
    await expect(policy.isOwner('u-propio', 'u-ajeno')).resolves.toBe(false);
    expect(findById).not.toHaveBeenCalled();
  });

  it('niega un recurso sin dueño', async () => {
    const { policy, findById } = policyWith(ACTIVO);
    await expect(policy.isOwner('u-propio', null)).resolves.toBe(false);
    await expect(policy.isOwner('u-propio', undefined)).resolves.toBe(false);
    expect(findById).not.toHaveBeenCalled();
  });

  it('niega a identidades inexistentes, inactivas o bloqueadas', async () => {
    for (const estado of ['inactivo', 'bloqueado'] as const) {
      const { policy } = policyWith({ ...ACTIVO, estado });
      await expect(policy.isOwner('u-propio', 'u-propio')).resolves.toBe(false);
    }
    const missing = policyWith(null);
    await expect(missing.policy.isOwner('u-propio', 'u-propio')).resolves.toBe(false);
  });
});
