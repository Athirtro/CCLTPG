import { Inject, Injectable } from '@nestjs/common';

import type { PartialScope } from '../../../shared/auth/auth-metadata.js';
import { env } from '../../../shared/config/env.js';
import { decideLoginStatus } from '../domain/login-state.js';
import type {
  FullSession,
  LoginStatus,
  PerfilVigente,
  ProfileSummary,
  RequestContext,
  UsuarioSnapshot,
} from '../domain/identity.types.js';
import { SessionCache } from './ports/session-cache.js';
import { SessionService } from './session.service.js';

export interface AuthResponse {
  status: LoginStatus;
  mustChangePassword: boolean;
  profiles: ProfileSummary[];
  sessionToken?: string;
  partialScope?: PartialScope;
  session?: FullSession;
}

const SCOPE_BY_STATUS: Partial<Record<LoginStatus, PartialScope>> = {
  password_change_required: 'pwd_change',
  mfa_enrollment_required: 'mfa_enroll',
  mfa_required: 'mfa_verify',
};

export function summarizeProfiles(profiles: readonly PerfilVigente[]): ProfileSummary[] {
  return profiles
    .map((profile) => ({ codigo: profile.codigo, validUntil: profile.validUntil }))
    .sort((left, right) => left.codigo.localeCompare(right.codigo, 'en'));
}

@Injectable()
export class AuthStateService {
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(SessionCache) private readonly cache: SessionCache,
  ) {}

  /** Decide el siguiente estado tras validar credenciales. */
  async start(
    usuario: UsuarioSnapshot,
    profiles: readonly PerfilVigente[],
    amr: readonly string[],
    context: RequestContext,
  ): Promise<AuthResponse> {
    const status = decideLoginStatus({
      mustChangePassword: usuario.debeCambiarPassword,
      mfaRequired: profiles.some(
        (profile) =>
          profile.codigo === 'administrador' ||
          profile.codigo === 'educador' ||
          profile.validUntil !== null,
      ),
      mfaEnabled: usuario.mfaHabilitado,
    });

    if (status === 'authenticated') {
      return this.complete(usuario, profiles, amr, context);
    }

    const scope = SCOPE_BY_STATUS[status];
    if (!scope) {
      throw new Error(`Estado de login sin ámbito parcial: ${status}`);
    }

    const sessionToken = await this.cache.issuePartial(
      usuario.id,
      scope,
      env.PARTIAL_TOKEN_TTL_SECONDS,
    );

    return {
      status,
      mustChangePassword: usuario.debeCambiarPassword,
      profiles: summarizeProfiles(profiles),
      sessionToken,
      partialScope: scope,
    };
  }

  /** Emite una sesión completa (tras MFA, cambio de contraseña o login directo). */
  async complete(
    usuario: UsuarioSnapshot,
    profiles: readonly PerfilVigente[],
    amr: readonly string[],
    context: RequestContext,
  ): Promise<AuthResponse> {
    const session = await this.sessions.issueFullSession(usuario, profiles, amr, context, {
      auditStart: true,
    });

    return {
      status: 'authenticated',
      mustChangePassword: false,
      profiles: summarizeProfiles(profiles),
      session,
    };
  }
}
