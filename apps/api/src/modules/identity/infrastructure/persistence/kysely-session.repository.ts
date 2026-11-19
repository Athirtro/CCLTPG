import type { Kysely, Transaction } from 'kysely';

import type { Database } from '../../../../database/schema.js';
import type {
  NewRefreshToken,
  RefreshTokenRecord,
  SessionRepository,
} from '../../application/ports/session.repository.js';

type Executor = Kysely<Database> | Transaction<Database>;

export class KyselySessionRepository implements SessionRepository {
  constructor(private readonly db: Executor) {}

  async create(token: NewRefreshToken): Promise<void> {
    await this.db
      .insertInto('refresh_token')
      .values({
        id: token.id,
        usuario_id: token.usuarioId,
        token_hash: token.tokenHash,
        familia_id: token.familiaId,
        expira_en: token.expiraEn,
        revocado_en: null,
        reemplazado_por: null,
        ip: token.ip,
        user_agent: token.userAgent,
      })
      .execute();
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.db
      .selectFrom('refresh_token')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst();
    return row ? this.map(row) : null;
  }

  async lockByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.db
      .selectFrom('refresh_token')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .forUpdate()
      .executeTakeFirst();
    return row ? this.map(row) : null;
  }

  async markRotated(currentId: string, nextId: string, at: Date): Promise<void> {
    await this.db
      .updateTable('refresh_token')
      .set({ reemplazado_por: nextId, revocado_en: at })
      .where('id', '=', currentId)
      .execute();
  }

  async revokeFamily(familiaId: string, at: Date): Promise<number> {
    const result = await this.db
      .updateTable('refresh_token')
      .set({ revocado_en: at })
      .where('familia_id', '=', familiaId)
      .where('revocado_en', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0);
  }

  async revokeUserFamilies(
    userId: string,
    keepFamiliaId: string | null,
    at: Date,
  ): Promise<number> {
    let query = this.db
      .updateTable('refresh_token')
      .set({ revocado_en: at })
      .where('usuario_id', '=', userId)
      .where('revocado_en', 'is', null);

    if (keepFamiliaId) {
      query = query.where('familia_id', '!=', keepFamiliaId);
    }

    const result = await query.executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0);
  }

  private map(row: {
    id: string;
    usuario_id: string;
    token_hash: string;
    familia_id: string;
    expira_en: Date;
    revocado_en: Date | null;
    reemplazado_por: string | null;
  }): RefreshTokenRecord {
    return {
      id: row.id,
      usuarioId: row.usuario_id,
      tokenHash: row.token_hash,
      familiaId: row.familia_id,
      expiraEn: row.expira_en,
      revocadoEn: row.revocado_en,
      reemplazadoPor: row.reemplazado_por,
    };
  }
}
