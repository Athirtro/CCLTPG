import { Inject, Injectable } from '@nestjs/common';

import {
  IDENTITY_DIRECTORY,
  type IdentityDirectory,
} from '../../../shared/integration/identity-directory.port.js';
import type { EmisoraOwnershipPolicy } from '../../../shared/integration/ownership.port.js';

/**
 * Política de propiedad para permisos `*_own` (plan §5.2, ADR-0005 decisión 3).
 *
 * La igualdad de identificadores no basta: el principal debe existir y estar
 * `activo` según el contexto dueño de la identidad, consultado por puerto. Un
 * recurso sin dueño, ajeno o resuelto a una identidad inactiva nunca concede
 * propiedad, de modo que el controlador pueda responder 404 sin revelar
 * existencia.
 */
@Injectable()
export class IdentityOwnershipPolicy implements EmisoraOwnershipPolicy {
  constructor(@Inject(IDENTITY_DIRECTORY) private readonly identity: IdentityDirectory) {}

  async isOwner(usuarioId: string, ownerUsuarioId: string | null | undefined): Promise<boolean> {
    if (ownerUsuarioId === null || ownerUsuarioId === undefined || ownerUsuarioId !== usuarioId) {
      return false;
    }

    const usuario = await this.identity.findById(usuarioId);
    return usuario?.estado === 'activo';
  }
}
