import { Inject, Injectable } from '@nestjs/common';

import { validatePassword } from '../domain/password-policy.js';
import type { RequestContext } from '../domain/identity.types.js';
import { AuthError } from './auth-error.js';
import { AuthStateService, type AuthResponse } from './auth-state.service.js';
import { RATE_LIMITS } from './rate-limits.js';
import { Clock } from './ports/clock.js';
import { IdentityRepository } from './ports/identity.repository.js';
import { PasswordHasher } from './ports/password-hasher.js';
import { RateLimiter } from './ports/rate-limiter.js';
import { SessionCache } from './ports/session-cache.js';
import { UnitOfWork } from './ports/unit-of-work.js';

@Injectable()
export class PasswordService {
  constructor(
    @Inject(IdentityRepository) private readonly identity: IdentityRepository,
    @Inject(PasswordHasher) private readonly hasher: PasswordHasher,
    @Inject(AuthStateService) private readonly authState: AuthStateService,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
    @Inject(SessionCache) private readonly cache: SessionCache,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
    @Inject(Clock) private readonly clock: Clock,
  ) {}

  async change(input: {
    usuarioId: string;
    currentPassword: string;
    newPassword: string;
    /** Familia que se conserva (sesión completa) o `null` (token parcial). */
    keepFamiliaId: string | null;
    partialToken?: string;
    context: RequestContext;
  }): Promise<AuthResponse | null> {
    const limit = await this.limiter.hit(
      `pwd:change:${input.usuarioId}`,
      RATE_LIMITS.passwordUser.limit,
      RATE_LIMITS.passwordUser.windowSeconds,
    );
    if (!limit.allowed) {
      throw AuthError.rateLimited(limit.retryAfterSeconds);
    }

    const usuario = await this.identity.findById(input.usuarioId);
    if (!usuario) {
      throw AuthError.tokenInvalid();
    }

    if (!(await this.hasher.verify(usuario.passwordHash, input.currentPassword))) {
      throw AuthError.currentPasswordInvalid();
    }

    const violations = validatePassword(input.newPassword, usuario.email);
    if (violations.length > 0) {
      throw AuthError.passwordPolicy(violations);
    }

    const passwordHash = await this.hasher.hash(input.newPassword);

    await this.unitOfWork.run(async (tx) => {
      await tx.identity.updatePasswordHash(usuario.id, passwordHash, this.clock.now());
      await tx.identity.setMustChangePassword(usuario.id, false, this.clock.now());
      const count = await tx.sessions.revokeUserFamilies(
        usuario.id,
        input.keepFamiliaId,
        this.clock.now(),
      );
      await tx.audit.record({
        accion: 'usuario.password_cambiada',
        recurso: 'usuario',
        recursoId: usuario.id,
        actorId: usuario.id,
        actorPerfil: null,
        ip: input.context.ip,
        dispositivo: input.context.userAgent,
        datosDespues: {
          sesiones_revocadas: count,
          via: input.partialToken ? 'pwd_change' : 'session',
        },
        requestId: input.context.requestId,
      });
      return count;
    });

    if (!input.partialToken) {
      return null;
    }

    await this.cache.invalidatePartial(input.partialToken, 'pwd_change');

    const updated = await this.identity.findById(usuario.id);
    const profiles = await this.identity.listProfiles(usuario.id, this.clock.now());
    if (!updated || profiles.length === 0) {
      throw AuthError.tokenInvalid();
    }

    return this.authState.start(updated, profiles, ['pwd'], input.context);
  }
}
