import { Injectable } from '@nestjs/common';

import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';

export interface MeResponse {
  userId: string;
  email: string;
  nombre: string;
  estado: string;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  profiles: Array<{ codigo: string; nombre: string; validUntil: Date | null }>;
  activeProfile: string | null;
  permissions: string[];
}

@Injectable()
export class MeService {
  build(principal: AuthPrincipal): MeResponse {
    return {
      userId: principal.userId,
      email: principal.email,
      nombre: principal.nombre,
      estado: principal.estado,
      mfaEnabled: principal.mfaEnabled,
      mustChangePassword: principal.mustChangePassword,
      profiles: principal.profiles
        .map((profile) => ({
          codigo: profile.codigo,
          nombre: profile.nombre,
          validUntil: profile.validUntil,
        }))
        .sort((left, right) => left.codigo.localeCompare(right.codigo, 'en')),
      activeProfile: principal.activeProfile,
      permissions: principal.permissions,
    };
  }
}
