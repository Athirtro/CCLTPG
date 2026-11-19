export interface RefreshTokenRecord {
  id: string;
  usuarioId: string;
  tokenHash: string;
  familiaId: string;
  expiraEn: Date;
  revocadoEn: Date | null;
  reemplazadoPor: string | null;
}

export interface NewRefreshToken {
  id: string;
  usuarioId: string;
  tokenHash: string;
  familiaId: string;
  expiraEn: Date;
  ip: string | null;
  userAgent: string | null;
}

export abstract class SessionRepository {
  abstract create(token: NewRefreshToken): Promise<void>;
  abstract findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /** `SELECT … FOR UPDATE`: serializa refresh concurrentes (auth-v1 §2.2). */
  abstract lockByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  abstract markRotated(currentId: string, nextId: string, at: Date): Promise<void>;
  abstract revokeFamily(familiaId: string, at: Date): Promise<number>;
  abstract revokeUserFamilies(
    userId: string,
    keepFamiliaId: string | null,
    at: Date,
  ): Promise<number>;
}
