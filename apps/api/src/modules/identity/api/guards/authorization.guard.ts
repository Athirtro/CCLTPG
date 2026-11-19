import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { AuthContext, AuthPrincipal } from '../../../../shared/auth/auth-principal.js';
import {
  ALLOW_ANONYMOUS_KEY,
  ALLOW_PASSWORD_CHANGE_KEY,
  AUTHENTICATED_ONLY_KEY,
  PARTIAL_SCOPES_KEY,
  REQUIRE_PERMISSIONS_KEY,
  SKIP_CSRF_KEY,
  type PartialScope,
} from '../../../../shared/auth/auth-metadata.js';
import { PUBLIC_ROUTE_KEY } from '../../../../shared/auth/public.decorator.js';
import { satisfiesAny } from '../../domain/permissions.js';
import { AuthError } from '../../application/auth-error.js';
import { RATE_LIMITS } from '../../application/rate-limits.js';
import { RateLimiter } from '../../application/ports/rate-limiter.js';
import { SessionCache } from '../../application/ports/session-cache.js';
import { SessionService } from '../../application/session.service.js';
import { CsrfService } from '../csrf.service.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function bearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') {
    return null;
  }

  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function partialTokenFromBody(request: Request): string | null {
  const body: unknown = request.body;
  if (!body || typeof body !== 'object') {
    return null;
  }

  const value = (body as Record<string, unknown>).sessionToken;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Guard global de autenticación y autorización (ADR-0001, AC-SEC-01/13/15/16).
 *
 * Orden: sesión → estado (lo aplica `resolvePrincipal`) → cambio de contraseña
 * → permiso → ámbito (en el recurso) → CSRF. **Denegación por defecto**: si la
 * ruta no declara metadatos de autorización, se rechaza.
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(SessionCache) private readonly cache: SessionCache,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
    @Inject(CsrfService) private readonly csrf: CsrfService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, targets) === true;
    if (isPublic) {
      return true;
    }

    const required =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS_KEY, targets) ?? [];
    const partialScopes =
      this.reflector.getAllAndOverride<PartialScope[]>(PARTIAL_SCOPES_KEY, targets) ?? [];
    const authenticatedOnly =
      this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_ONLY_KEY, targets) === true;
    const allowPasswordChange =
      this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_KEY, targets) === true;
    const allowAnonymous =
      this.reflector.getAllAndOverride<boolean>(ALLOW_ANONYMOUS_KEY, targets) === true;
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, targets) === true;

    const request = context.switchToHttp().getRequest<Request & AuthContext>();
    const partialOnly = partialScopes.length > 0 && !authenticatedOnly && required.length === 0;

    if (
      partialScopes.length === 0 &&
      !authenticatedOnly &&
      required.length === 0 &&
      !allowAnonymous
    ) {
      throw bearerToken(request) ? AuthError.permissionDenied() : AuthError.tokenInvalid();
    }

    const token = partialOnly ? null : bearerToken(request);
    let principal: AuthPrincipal | null = null;

    if (token) {
      principal = await this.sessions.resolvePrincipal(
        token,
        headerValue(request.headers['x-perfil-activo']),
      );

      if (principal.mustChangePassword && !allowPasswordChange) {
        throw AuthError.passwordChangeRequired();
      }

      if (required.length > 0 && !satisfiesAny(principal.permissions, required)) {
        throw AuthError.permissionDenied();
      }

      principal.actorProfile = this.sessions.selectActorProfile(
        principal,
        required,
        headerValue(request.headers['x-perfil-activo']),
      );
      request.auth = principal;

      if (MUTATING_METHODS.has(request.method) && !skipCsrf) {
        this.csrf.assert(request);
      }

      const limit = await this.limiter.hit(
        `api:user:${principal.userId}`,
        RATE_LIMITS.apiUser.limit,
        RATE_LIMITS.apiUser.windowSeconds,
      );
      if (!limit.allowed) {
        throw AuthError.generalRateLimited(limit.retryAfterSeconds);
      }

      return true;
    }

    if (partialScopes.length > 0) {
      const rawToken = partialTokenFromBody(request);
      if (!rawToken) {
        throw AuthError.mfaSessionInvalid();
      }

      for (const scope of partialScopes) {
        const record = await this.cache.getPartial(rawToken, scope);
        if (record) {
          request.authPartial = {
            usuarioId: record.usuarioId,
            scope,
            token: rawToken,
          };
          return true;
        }
      }

      throw AuthError.mfaSessionInvalid();
    }

    if (allowAnonymous) {
      return true;
    }

    throw AuthError.tokenInvalid();
  }
}
