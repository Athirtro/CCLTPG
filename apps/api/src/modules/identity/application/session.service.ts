import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import { env } from '../../../shared/config/env.js';
import { expandPermissions, satisfiesAny } from '../domain/permissions.js';
import type {
  FullSession,
  PerfilVigente,
  RequestContext,
  UsuarioSnapshot,
} from '../domain/identity.types.js';
import { AuthError } from './auth-error.js';
import { Clock } from './ports/clock.js';
import { IdentityRepository } from './ports/identity.repository.js';
import { SessionCache } from './ports/session-cache.js';
import { SessionRepository } from './ports/session.repository.js';
import { TokenService } from './ports/token.service.js';
import { UnitOfWork } from './ports/unit-of-work.js';

type RefreshOutcome =
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'reused'; familiaId: string; usuarioId: string }
  | { kind: 'revoked'; familiaId: string }
  | { kind: 'rotated'; session: FullSession; usuarioId: string };

@Injectable()
export class SessionService {
  constructor(
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
    @Inject(IdentityRepository) private readonly identity: IdentityRepository,
    @Inject(SessionRepository) private readonly sessions: SessionRepository,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(SessionCache) private readonly cache: SessionCache,
    @Inject(Clock) private readonly clock: Clock,
  ) {}

  private refreshExpiry(now: Date): Date {
    return new Date(now.getTime() + env.REFRESH_TOKEN_TTL_SECONDS * 1000);
  }

  async issueFullSession(
    usuario: UsuarioSnapshot,
    profiles: readonly PerfilVigente[],
    amr: readonly string[],
    context: RequestContext,
    options: { auditStart: boolean } = { auditStart: true },
  ): Promise<FullSession> {
    const now = this.clock.now();
    const sid = uuidv7();
    const jti = uuidv7();
    const refreshToken = this.tokens.createOpaqueToken();
    const refreshExpiresAt = this.refreshExpiry(now);
    const access = await this.tokens.signAccess({ sub: usuario.id, sid, jti, amr: [...amr] });

    await this.unitOfWork.run(async (tx) => {
      await tx.sessions.create({
        id: uuidv7(),
        usuarioId: usuario.id,
        tokenHash: this.tokens.hashToken(refreshToken),
        familiaId: sid,
        expiraEn: refreshExpiresAt,
        ip: context.ip,
        userAgent: context.userAgent,
      });

      if (options.auditStart) {
        await tx.audit.record({
          accion: 'sesion.iniciada',
          recurso: 'usuario',
          recursoId: usuario.id,
          actorId: usuario.id,
          actorPerfil: profiles[0]?.codigo ?? null,
          ip: context.ip,
          dispositivo: context.userAgent,
          datosDespues: { amr: [...amr], perfiles: profiles.map((profile) => profile.codigo) },
          requestId: context.requestId,
        });
      }
    });

    await this.cache.setSessionAmr(sid, amr, refreshExpiresAt);

    return {
      accessToken: access.token,
      refreshToken,
      csrfToken: this.tokens.createOpaqueToken(),
      expiresIn: access.expiresIn,
      sid,
      jti,
      refreshExpiresAt,
    };
  }

  /** Rotación estricta con detección de reutilización (AC-SEC-09). */
  async refresh(rawToken: string, context: RequestContext): Promise<FullSession> {
    const now = this.clock.now();
    const tokenHash = this.tokens.hashToken(rawToken);
    const refreshExpiresAt = this.refreshExpiry(now);

    const outcome = await this.unitOfWork.run<RefreshOutcome>(async (tx) => {
      const current = await tx.sessions.lockByHash(tokenHash);
      if (!current) {
        return { kind: 'invalid' };
      }

      if (current.revocadoEn !== null || current.reemplazadoPor !== null) {
        await tx.sessions.revokeFamily(current.familiaId, now);
        await tx.audit.record({
          accion: 'sesion.refresh_reutilizado',
          recurso: 'usuario',
          recursoId: current.usuarioId,
          actorId: current.usuarioId,
          ip: context.ip,
          dispositivo: context.userAgent,
          datosDespues: {
            familia_id: current.familiaId,
            ip: context.ip,
            user_agent: context.userAgent,
          },
          requestId: context.requestId,
        });
        return {
          kind: 'reused',
          familiaId: current.familiaId,
          usuarioId: current.usuarioId,
        };
      }

      if (current.expiraEn.getTime() <= now.getTime()) {
        return { kind: 'expired' };
      }

      const usuario = await tx.identity.findById(current.usuarioId);
      const profiles = usuario ? await tx.identity.listProfiles(usuario.id, now) : [];

      if (!usuario || usuario.estado !== 'activo' || profiles.length === 0) {
        await tx.sessions.revokeFamily(current.familiaId, now);
        await tx.audit.record({
          accion: 'sesion.revocada',
          recurso: 'usuario',
          recursoId: current.usuarioId,
          actorId: current.usuarioId,
          ip: context.ip,
          dispositivo: context.userAgent,
          datosDespues: { motivo: 'estado_o_perfil_no_vigente', familias: 1 },
          requestId: context.requestId,
        });
        return { kind: 'revoked', familiaId: current.familiaId };
      }

      const amr = (await this.cache.getSessionAmr(current.familiaId)) ?? ['pwd'];
      const jti = uuidv7();
      const access = await this.tokens.signAccess({
        sub: usuario.id,
        sid: current.familiaId,
        jti,
        amr,
      });
      const nextToken = this.tokens.createOpaqueToken();
      const nextId = uuidv7();

      await tx.sessions.create({
        id: nextId,
        usuarioId: usuario.id,
        tokenHash: this.tokens.hashToken(nextToken),
        familiaId: current.familiaId,
        expiraEn: refreshExpiresAt,
        ip: context.ip,
        userAgent: context.userAgent,
      });
      await tx.sessions.markRotated(current.id, nextId, now);

      return {
        kind: 'rotated',
        usuarioId: usuario.id,
        session: {
          accessToken: access.token,
          refreshToken: nextToken,
          csrfToken: '',
          expiresIn: access.expiresIn,
          sid: current.familiaId,
          jti,
          refreshExpiresAt,
        },
      };
    });

    switch (outcome.kind) {
      case 'invalid':
        throw AuthError.tokenInvalid();
      case 'expired':
        throw AuthError.tokenExpired();
      case 'reused':
        await this.cache.denySid(outcome.familiaId, new Date(now.getTime() + 900_000));
        throw AuthError.tokenReused();
      case 'revoked':
        await this.cache.denySid(outcome.familiaId, new Date(now.getTime() + 900_000));
        throw AuthError.tokenRevoked();
      case 'rotated':
        await this.cache.setSessionAmr(outcome.session.sid, ['pwd'], refreshExpiresAt);
        return outcome.session;
    }
  }

  /**
   * Logout idempotente. Acepta access, cookie o ambos; nunca falla si no hay
   * sesión (AC-SEC-10).
   */
  async logout(
    principal: AuthPrincipal | null,
    rawRefreshToken: string | null,
    context: RequestContext,
  ): Promise<void> {
    const now = this.clock.now();
    const deniedUntil = new Date(now.getTime() + env.ACCESS_TOKEN_TTL_SECONDS * 1000);

    if (rawRefreshToken) {
      const record = await this.sessions.findByHash(this.tokens.hashToken(rawRefreshToken));
      if (record) {
        await this.unitOfWork.run(async (tx) => {
          await tx.sessions.revokeFamily(record.familiaId, now);
          await tx.audit.record({
            accion: 'sesion.cerrada',
            recurso: 'usuario',
            recursoId: record.usuarioId,
            actorId: record.usuarioId,
            ip: context.ip,
            dispositivo: context.userAgent,
            datosDespues: { familia_id: record.familiaId, motivo: 'logout' },
            requestId: context.requestId,
          });
        });
        await this.cache.denySid(record.familiaId, deniedUntil);
      }
    }

    if (principal) {
      await this.unitOfWork.run(async (tx) => {
        await tx.sessions.revokeFamily(principal.sid, now);
        await tx.audit.record({
          accion: 'sesion.cerrada',
          recurso: 'usuario',
          recursoId: principal.userId,
          actorId: principal.userId,
          actorPerfil: principal.actorProfile,
          ip: context.ip,
          dispositivo: context.userAgent,
          datosDespues: { familia_id: principal.sid, motivo: 'logout' },
          requestId: context.requestId,
        });
      });
      await this.cache.denySid(principal.sid, deniedUntil);
    }
  }

  async resolvePrincipal(
    accessToken: string,
    requestedProfile: string | null,
  ): Promise<AuthPrincipal> {
    const claims = await this.tokens.verifyAccess(accessToken);

    if ((await this.cache.isSidDenied(claims.sid)) || (await this.cache.isJtiDenied(claims.jti))) {
      throw AuthError.tokenRevoked();
    }

    const usuario = await this.identity.findById(claims.sub);
    const profiles = usuario ? await this.identity.listProfiles(usuario.id, this.clock.now()) : [];

    if (!usuario || usuario.estado !== 'activo' || profiles.length === 0) {
      await this.revokeUserFamilies(usuario?.id ?? claims.sub, null);
      await this.cache.denySid(claims.sid, new Date(claims.exp * 1000));
      throw AuthError.tokenRevoked();
    }

    const granted = await this.identity.listGrantedPermissions(
      profiles.map((profile) => profile.id),
    );
    const grants = profiles.map((profile) => ({
      profileId: profile.id,
      profileCode: profile.codigo,
      permissions: expandPermissions(
        granted.filter((row) => row.perfilId === profile.id).map((row) => row.codigo),
      ),
    }));
    const permissions = [...new Set(grants.flatMap((grant) => grant.permissions))].sort(
      (left, right) => left.localeCompare(right, 'en'),
    );

    const requested = requestedProfile
      ? (profiles.find((profile) => profile.codigo === requestedProfile) ?? null)
      : null;

    if (requestedProfile && !requested) {
      throw AuthError.activeProfileInvalid();
    }

    return {
      userId: usuario.id,
      sid: claims.sid,
      jti: claims.jti,
      amr: claims.amr,
      email: usuario.email,
      nombre: usuario.nombre,
      estado: usuario.estado,
      mfaEnabled: usuario.mfaHabilitado,
      mustChangePassword: usuario.debeCambiarPassword,
      profiles: profiles.map((profile) => ({
        id: profile.id,
        codigo: profile.codigo,
        nombre: profile.nombre,
        validUntil: profile.validUntil,
      })),
      permissions,
      grants,
      actorProfile: requested?.codigo ?? profiles[0]?.codigo ?? null,
      activeProfile: requested?.codigo ?? profiles[0]?.codigo ?? null,
      accessTokenExpiresAt: new Date(claims.exp * 1000),
    };
  }

  /** Perfil que realmente otorga el permiso; desempata `X-Perfil-Activo`. */
  selectActorProfile(
    principal: AuthPrincipal,
    required: readonly string[],
    requestedProfile: string | null,
  ): string | null {
    if (required.length === 0) {
      return requestedProfile ?? principal.profiles[0]?.codigo ?? null;
    }

    if (requestedProfile) {
      const requestedGrant = principal.grants.find(
        (grant) => grant.profileCode === requestedProfile,
      );
      if (requestedGrant && satisfiesAny(requestedGrant.permissions, required)) {
        return requestedProfile;
      }
    }

    return (
      principal.grants.find((grant) => satisfiesAny(grant.permissions, required))?.profileCode ??
      principal.actorProfile
    );
  }

  async revokeUserFamilies(userId: string, keepFamiliaId: string | null): Promise<number> {
    return this.unitOfWork.run((tx) =>
      tx.sessions.revokeUserFamilies(userId, keepFamiliaId, this.clock.now()),
    );
  }
}
