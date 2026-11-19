import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { AUDIT_PORT, type AuditPort } from '../../../shared/audit/audit.port.js';
import { env } from '../../../shared/config/env.js';
import { mfaAad } from '../../../shared/security/encryption.js';
import type { MfaMethod, RequestContext, UsuarioSnapshot } from '../domain/identity.types.js';
import { AuthError } from './auth-error.js';
import { AuthStateService, type AuthResponse } from './auth-state.service.js';
import { RATE_LIMITS } from './rate-limits.js';
import { Clock } from './ports/clock.js';
import { FieldEncryption } from './ports/field-encryption.js';
import { IdentityRepository } from './ports/identity.repository.js';
import { PasswordHasher } from './ports/password-hasher.js';
import { RateLimiter } from './ports/rate-limiter.js';
import { SessionCache } from './ports/session-cache.js';
import { TokenService } from './ports/token.service.js';
import { TotpService } from './ports/totp.service.js';
import { UnitOfWork } from './ports/unit-of-work.js';

const RECOVERY_CODE_AMOUNT = 10;
const RECOVERY_CODE_PATTERN = /^[A-Z2-7]{10}$/u;

export interface VerificationResult {
  method: MfaMethod;
  recoveryCodeId?: string;
}

@Injectable()
export class MfaService {
  constructor(
    @Inject(IdentityRepository) private readonly identity: IdentityRepository,
    @Inject(PasswordHasher) private readonly hasher: PasswordHasher,
    @Inject(TotpService) private readonly totp: TotpService,
    @Inject(FieldEncryption) private readonly encryption: FieldEncryption,
    @Inject(AuthStateService) private readonly authState: AuthStateService,
    @Inject(SessionCache) private readonly cache: SessionCache,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  /** POST /auth/mfa/verify con token parcial `mfa_verify`. */
  async verify(input: {
    usuarioId: string;
    partialToken: string;
    code: string;
    method: MfaMethod;
    context: RequestContext;
  }): Promise<AuthResponse> {
    const limit = await this.limiter.hit(
      `mfa:user:${input.usuarioId}`,
      RATE_LIMITS.mfaUser.limit,
      RATE_LIMITS.mfaUser.windowSeconds,
    );
    if (!limit.allowed) {
      throw AuthError.rateLimited(limit.retryAfterSeconds);
    }

    const usuario = await this.identity.findById(input.usuarioId);
    if (!usuario || !usuario.mfaHabilitado) {
      throw AuthError.mfaSessionInvalid();
    }

    let verification: VerificationResult | null = null;
    try {
      verification = await this.checkCode(usuario, input.code, input.method, input.context);
    } catch (error) {
      if (!(error instanceof AuthError)) {
        throw error;
      }
      verification = null;
    }

    if (!verification) {
      const attempts = await this.cache.incrementPartialAttempts(input.partialToken, 'mfa_verify');
      await this.audit.record({
        accion: 'sesion.mfa_fallida',
        recurso: 'usuario',
        recursoId: usuario.id,
        actorId: usuario.id,
        actorPerfil: null,
        ip: input.context.ip,
        dispositivo: input.context.userAgent,
        datosDespues: { metodo: input.method, intento: attempts },
        requestId: input.context.requestId,
      });

      if (attempts >= RATE_LIMITS.mfaToken.limit) {
        await this.cache.invalidatePartial(input.partialToken, 'mfa_verify');
        await this.audit.record({
          accion: 'sesion.mfa_agotada',
          recurso: 'usuario',
          recursoId: usuario.id,
          actorId: usuario.id,
          actorPerfil: null,
          ip: input.context.ip,
          dispositivo: input.context.userAgent,
          datosDespues: { intentos: attempts },
          requestId: input.context.requestId,
        });
        throw AuthError.mfaAttemptsExceeded();
      }

      throw AuthError.mfaInvalidCode();
    }

    await this.cache.invalidatePartial(input.partialToken, 'mfa_verify');
    await this.audit.record({
      accion: 'sesion.mfa_verificada',
      recurso: 'usuario',
      recursoId: usuario.id,
      actorId: usuario.id,
      actorPerfil: null,
      ip: input.context.ip,
      dispositivo: input.context.userAgent,
      datosDespues: { metodo: verification.method },
      requestId: input.context.requestId,
    });

    const profiles = await this.identity.listProfiles(usuario.id, this.clock.now());
    if (profiles.length === 0) {
      throw AuthError.mfaSessionInvalid();
    }

    return this.authState.complete(
      usuario,
      profiles,
      ['pwd', verification.method === 'recovery' ? 'recovery' : 'totp'],
      input.context,
    );
  }

  /** POST /auth/mfa/enroll (token parcial `mfa_enroll` o sesión completa). */
  async enroll(usuarioId: string): Promise<{ secret: string; otpauthUri: string }> {
    const usuario = await this.identity.findById(usuarioId);
    if (!usuario) {
      throw AuthError.mfaSessionInvalid();
    }

    if (usuario.mfaHabilitado) {
      throw AuthError.mfaAlreadyEnabled();
    }

    const secret = this.totp.generateSecret();
    await this.unitOfWork.run(async (tx) => {
      await tx.identity.setMfaSecretCifrado(
        usuario.id,
        this.encryption.encrypt(secret, mfaAad(usuario.id)),
        this.clock.now(),
      );
    });

    return {
      secret,
      otpauthUri: this.totp.otpauthUri(secret, usuario.email),
    };
  }

  /** POST /auth/mfa/enroll/confirm */
  async confirm(input: {
    usuarioId: string;
    code: string;
    context: RequestContext;
  }): Promise<{ auth: AuthResponse; recoveryCodes: string[] }> {
    const usuario = await this.identity.findById(input.usuarioId);
    if (!usuario) {
      throw AuthError.mfaSessionInvalid();
    }

    if (usuario.mfaHabilitado) {
      throw AuthError.mfaAlreadyEnabled();
    }

    if (!usuario.mfaSecretCifrado) {
      throw AuthError.mfaInvalidCode();
    }

    const secret = this.encryption.decrypt(usuario.mfaSecretCifrado, mfaAad(usuario.id));
    if (!this.totp.verify(secret, input.code, this.clock.now())) {
      throw AuthError.mfaInvalidCode();
    }

    const recoveryCodes = this.generateRecoveryCodes();
    const hashes = await this.hashRecoveryCodes(recoveryCodes);

    await this.unitOfWork.run(async (tx) => {
      await tx.identity.enableMfa(usuario.id, this.clock.now());
      await tx.identity.replaceRecoveryCodes(
        usuario.id,
        hashes.map((hash) => ({ id: uuidv7(), hash })),
        this.clock.now(),
      );
      await tx.audit.record({
        accion: 'usuario.mfa_inscrita',
        recurso: 'usuario',
        recursoId: usuario.id,
        actorId: usuario.id,
        actorPerfil: usuario.debeCambiarPassword ? null : undefined,
        ip: input.context.ip,
        dispositivo: input.context.userAgent,
        datosDespues: { metodo: 'totp', codigos_recuperacion: RECOVERY_CODE_AMOUNT },
        requestId: input.context.requestId,
      });
    });

    const updated = await this.identity.findById(usuario.id);
    const profiles = await this.identity.listProfiles(usuario.id, this.clock.now());
    if (!updated || profiles.length === 0) {
      throw AuthError.mfaSessionInvalid();
    }

    return {
      auth: await this.authState.complete(updated, profiles, ['pwd', 'totp'], input.context),
      recoveryCodes,
    };
  }

  /** POST /auth/mfa/recovery-codes */
  async regenerateRecoveryCodes(input: {
    usuarioId: string;
    code: string;
    context: RequestContext;
  }): Promise<{ recoveryCodes: string[] }> {
    const limit = await this.limiter.hit(
      `mfa:recovery:${input.usuarioId}`,
      RATE_LIMITS.recoveryUser.limit,
      RATE_LIMITS.recoveryUser.windowSeconds,
    );
    if (!limit.allowed) {
      throw AuthError.rateLimited(limit.retryAfterSeconds);
    }

    const usuario = await this.identity.findById(input.usuarioId);
    if (!usuario) {
      throw AuthError.mfaSessionInvalid();
    }

    if (!usuario.mfaHabilitado) {
      throw AuthError.mfaNotEnabled();
    }

    let verification: VerificationResult | null = null;
    try {
      verification = await this.checkCode(usuario, input.code, 'totp', input.context);
    } catch (error) {
      if (!(error instanceof AuthError)) {
        throw error;
      }
    }

    if (!verification) {
      try {
        verification = await this.checkCode(usuario, input.code, 'recovery', input.context);
      } catch (error) {
        if (!(error instanceof AuthError)) {
          throw error;
        }
      }
    }

    if (!verification) {
      throw AuthError.mfaInvalidCode();
    }

    const recoveryCodes = this.generateRecoveryCodes();
    const hashes = await this.hashRecoveryCodes(recoveryCodes);

    await this.unitOfWork.run(async (tx) => {
      await tx.identity.replaceRecoveryCodes(
        usuario.id,
        hashes.map((hash) => ({ id: uuidv7(), hash })),
        this.clock.now(),
      );
      await tx.audit.record({
        accion: 'usuario.mfa_recovery_regenerada',
        recurso: 'usuario',
        recursoId: usuario.id,
        actorId: usuario.id,
        actorPerfil: null,
        ip: input.context.ip,
        dispositivo: input.context.userAgent,
        datosDespues: { cantidad: RECOVERY_CODE_AMOUNT },
        requestId: input.context.requestId,
      });
    });

    return { recoveryCodes };
  }

  private async checkCode(
    usuario: UsuarioSnapshot,
    code: string,
    method: MfaMethod,
    context: RequestContext,
  ): Promise<VerificationResult> {
    if (method === 'totp') {
      if (!usuario.mfaSecretCifrado) {
        throw AuthError.mfaNotEnabled();
      }
      const secret = this.encryption.decrypt(usuario.mfaSecretCifrado, mfaAad(usuario.id));
      if (!this.totp.verify(secret, code, this.clock.now())) {
        throw AuthError.mfaInvalidCode();
      }
      return { method: 'totp' };
    }

    const candidate = code.replace(/[\s-]+/gu, '').toUpperCase();
    if (!RECOVERY_CODE_PATTERN.test(candidate)) {
      throw AuthError.mfaInvalidCode();
    }

    const codes = await this.identity.listRecoveryCodes(usuario.id);
    for (const record of codes) {
      if (await this.hasher.verify(record.hash, candidate)) {
        await this.unitOfWork.run(async (tx) => {
          await tx.identity.markRecoveryCodeUsed(record.id, this.clock.now());
          await tx.audit.record({
            accion: 'usuario.mfa_recovery_usada',
            recurso: 'usuario',
            recursoId: usuario.id,
            actorId: usuario.id,
            actorPerfil: null,
            ip: context.ip,
            dispositivo: context.userAgent,
            datosDespues: { restantes: Math.max(codes.length - 1, 0) },
            requestId: context.requestId,
          });
        });
        return { method: 'recovery', recoveryCodeId: record.id };
      }
    }

    throw AuthError.mfaInvalidCode();
  }

  private generateRecoveryCodes(): string[] {
    return Array.from({ length: RECOVERY_CODE_AMOUNT }, () => this.tokens.createRecoveryCode());
  }

  private async hashRecoveryCodes(codes: readonly string[]): Promise<string[]> {
    const hashes: string[] = [];
    for (const code of codes) {
      hashes.push(await this.hasher.hash(code));
    }
    return hashes;
  }

  /** Utilidad de pruebas: no se expone por HTTP. */
  get partialTtlSeconds(): number {
    return env.PARTIAL_TOKEN_TTL_SECONDS;
  }
}
