import { createHash, randomBytes } from 'node:crypto';

import { errors, jwtVerify, SignJWT } from 'jose';

import { env } from '../../../../shared/config/env.js';
import { base32Encode } from '../../../../shared/security/base32.js';
import { AuthError } from '../../application/auth-error.js';
import type {
  AccessTokenClaims,
  AccessTokenInput,
  TokenService,
} from '../../application/ports/token.service.js';

const encoder = new TextEncoder();

function keyFor(secret: string): Uint8Array {
  return encoder.encode(secret);
}

export class JoseTokenService implements TokenService {
  private readonly currentKey = keyFor(env.JWT_SECRET_CURRENT);
  private readonly previousKey = env.JWT_SECRET_PREVIOUS ? keyFor(env.JWT_SECRET_PREVIOUS) : null;

  async signAccess(input: AccessTokenInput): Promise<{ token: string; expiresIn: number }> {
    const expiresIn = env.ACCESS_TOKEN_TTL_SECONDS;
    const token = await new SignJWT({
      sid: input.sid,
      jti: input.jti,
      amr: input.amr,
      typ: 'access',
    })
      .setProtectedHeader({ alg: 'HS256', kid: env.JWT_KID_CURRENT })
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setSubject(input.sub)
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(this.currentKey);

    return { token, expiresIn };
  }

  async verifyAccess(token: string): Promise<AccessTokenClaims> {
    let payload;
    try {
      const result = await jwtVerify(
        token,
        (header) => {
          if (header.kid === env.JWT_KID_CURRENT) {
            return this.currentKey;
          }
          if (this.previousKey && header.kid === env.JWT_KID_PREVIOUS) {
            return this.previousKey;
          }
          throw new Error('kid desconocido');
        },
        {
          issuer: env.JWT_ISSUER,
          audience: env.JWT_AUDIENCE,
          algorithms: ['HS256'],
          clockTolerance: 30,
        },
      );
      payload = result.payload;
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        throw AuthError.tokenExpired();
      }
      throw AuthError.tokenInvalid();
    }

    const { sub, sid, jti, amr, iat, exp, typ } = payload;

    if (
      typ !== 'access' ||
      typeof sub !== 'string' ||
      typeof sid !== 'string' ||
      typeof jti !== 'string' ||
      typeof iat !== 'number' ||
      typeof exp !== 'number' ||
      !Array.isArray(amr) ||
      !amr.every((method) => typeof method === 'string')
    ) {
      throw AuthError.tokenInvalid();
    }

    return { sub, sid, jti, amr, iat, exp };
  }

  createOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  createRecoveryCode(): string {
    return base32Encode(randomBytes(7)).slice(0, 10);
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
