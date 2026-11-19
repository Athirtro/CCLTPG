import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_PORT, type AuditPort } from '../../../shared/audit/audit.port.js';
import { emailHmac } from '../../../shared/security/hmac.js';
import type { RequestContext, UsuarioSnapshot } from '../domain/identity.types.js';
import { AuthError } from './auth-error.js';
import { AuthStateService, type AuthResponse } from './auth-state.service.js';
import { MAX_PASSWORD_FAILURES, RATE_LIMITS } from './rate-limits.js';
import { Clock } from './ports/clock.js';
import { IdentityRepository } from './ports/identity.repository.js';
import { PasswordHasher } from './ports/password-hasher.js';
import { RateLimiter } from './ports/rate-limiter.js';
import { TokenService } from './ports/token.service.js';
import { UnitOfWork } from './ports/unit-of-work.js';

@Injectable()
export class LoginService {
  constructor(
    @Inject(IdentityRepository) private readonly identity: IdentityRepository,
    @Inject(PasswordHasher) private readonly hasher: PasswordHasher,
    @Inject(AuthStateService) private readonly authState: AuthStateService,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  async login(emailRaw: string, password: string, context: RequestContext): Promise<AuthResponse> {
    const email = emailRaw.trim().toLowerCase();
    const emailKey = this.tokens.hashToken(email);

    await this.enforce(`login:ip:${context.ip ?? 'unknown'}`, RATE_LIMITS.loginIp);
    await this.enforce(`login:email:${emailKey}`, RATE_LIMITS.loginEmail);

    const usuario = await this.identity.findByEmail(email);

    if (!usuario) {
      // Iguala el costo de Argon2 para no filtrar la existencia de la cuenta.
      await this.hasher.verifyDummy(password);
      await this.auditFailure(null, email, 'cuenta_inexistente', context);
      throw AuthError.invalidCredentials();
    }

    const passwordOk = await this.hasher.verify(usuario.passwordHash, password);

    if (!passwordOk) {
      await this.registerPasswordFailure(usuario, context);
      await this.auditFailure(usuario.id, email, 'password_invalida', context);
      throw AuthError.invalidCredentials();
    }

    if (usuario.estado !== 'activo') {
      await this.auditFailure(usuario.id, email, `estado_${usuario.estado}`, context);
      throw AuthError.invalidCredentials();
    }

    await this.limiter.reset(`pwd:${usuario.id}`);

    if (this.hasher.needsRehash(usuario.passwordHash)) {
      const rehashed = await this.hasher.hash(password);
      await this.unitOfWork.run((tx) =>
        tx.identity.updatePasswordHash(usuario.id, rehashed, this.clock.now()),
      );
      usuario.passwordHash = rehashed;
    }

    const profiles = await this.identity.listProfiles(usuario.id, this.clock.now());
    if (profiles.length === 0) {
      await this.auditFailure(usuario.id, email, 'sin_perfiles_vigentes', context);
      throw AuthError.invalidCredentials();
    }

    await this.audit.record({
      accion: 'sesion.credenciales_verificadas',
      recurso: 'usuario',
      recursoId: usuario.id,
      actorId: usuario.id,
      actorPerfil: profiles[0]?.codigo ?? null,
      ip: context.ip,
      dispositivo: context.userAgent,
      datosDespues: { amr_previsto: usuario.mfaHabilitado ? ['pwd', 'totp'] : ['pwd'] },
      requestId: context.requestId,
    });

    return this.authState.start(usuario, profiles, ['pwd'], context);
  }

  /**
   * Cinco fallos en 15 min bloquean la cuenta; el login sigue respondiendo el
   * mismo 401 (AC-SEC-05) y el desbloqueo es administrativo.
   */
  private async registerPasswordFailure(
    usuario: UsuarioSnapshot,
    context: RequestContext,
  ): Promise<void> {
    const result = await this.limiter.hit(
      `pwd:${usuario.id}`,
      MAX_PASSWORD_FAILURES,
      RATE_LIMITS.loginEmail.windowSeconds,
    );

    if (result.count < MAX_PASSWORD_FAILURES) {
      return;
    }

    await this.unitOfWork.run(async (tx) => {
      await tx.identity.setEstado(usuario.id, 'bloqueado', this.clock.now());
      await tx.sessions.revokeUserFamilies(usuario.id, null, this.clock.now());
      await tx.audit.record({
        accion: 'usuario.bloqueado',
        recurso: 'usuario',
        recursoId: usuario.id,
        actorId: null,
        actorPerfil: 'sistema',
        ip: context.ip,
        dispositivo: context.userAgent,
        datosAntes: { estado: usuario.estado },
        datosDespues: { estado: 'bloqueado', motivo: 'intentos_fallidos', intentos: result.count },
        requestId: context.requestId,
      });
    });
  }

  private async auditFailure(
    usuarioId: string | null,
    email: string,
    motivo: string,
    context: RequestContext,
  ): Promise<void> {
    await this.audit.record({
      accion: 'sesion.fallida',
      recurso: 'usuario',
      recursoId: usuarioId,
      actorId: usuarioId,
      actorPerfil: null,
      ip: context.ip,
      dispositivo: context.userAgent,
      datosDespues: { motivo, email_hmac: emailHmac(email) },
      requestId: context.requestId,
    });
  }

  private async enforce(
    key: string,
    limits: { limit: number; windowSeconds: number },
  ): Promise<void> {
    const result = await this.limiter.hit(key, limits.limit, limits.windowSeconds);
    if (!result.allowed) {
      throw AuthError.rateLimited(result.retryAfterSeconds);
    }
  }
}
