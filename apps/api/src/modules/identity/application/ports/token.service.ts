export interface AccessTokenClaims {
  sub: string;
  sid: string;
  jti: string;
  amr: string[];
  iat: number;
  exp: number;
}

export interface AccessTokenInput {
  sub: string;
  sid: string;
  jti: string;
  amr: string[];
}

export abstract class TokenService {
  abstract signAccess(input: AccessTokenInput): Promise<{ token: string; expiresIn: number }>;
  /** Lanza `AuthError` con `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_EXPIRED` o `AUTH_TOKEN_REVOKED`. */
  abstract verifyAccess(token: string): Promise<AccessTokenClaims>;
  abstract createOpaqueToken(): string;
  abstract createRecoveryCode(): string;
  abstract hashToken(token: string): string;
}
