import type { PartialScope } from '../../../../shared/auth/auth-metadata.js';

export interface PartialTokenRecord {
  usuarioId: string;
  attempts: number;
}

/**
 * Almacén efímero de tokens parciales, denylist de sesiones y contadores de
 * intentos. La implementación de producción usa Redis; las pruebas usan una
 * implementación en memoria.
 */
export abstract class SessionCache {
  abstract issuePartial(
    usuarioId: string,
    scope: PartialScope,
    ttlSeconds: number,
  ): Promise<string>;
  abstract getPartial(token: string, scope: PartialScope): Promise<PartialTokenRecord | null>;
  abstract incrementPartialAttempts(token: string, scope: PartialScope): Promise<number>;
  abstract invalidatePartial(token: string, scope: PartialScope): Promise<void>;

  abstract denySid(sid: string, expiresAt: Date): Promise<void>;
  abstract isSidDenied(sid: string): Promise<boolean>;
  abstract denyJti(jti: string, expiresAt: Date): Promise<void>;
  abstract isJtiDenied(jti: string): Promise<boolean>;

  /** Métodos de autenticación de la familia (`amr`), para el refresh. */
  abstract setSessionAmr(sid: string, amr: readonly string[], expiresAt: Date): Promise<void>;
  abstract getSessionAmr(sid: string): Promise<string[] | null>;
}
