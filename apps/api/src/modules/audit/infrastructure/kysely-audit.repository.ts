import type { Kysely } from 'kysely';

import type { Database } from '../../../database/schema.js';
import type { AuditFilter, AuditPage, AuditRow } from '../application/audit.types.js';
import type { AuditRepository } from '../application/ports/audit.repository.js';

export class KyselyAuditRepository implements AuditRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async list(filter: AuditFilter): Promise<AuditPage> {
    const [rows, total] = await Promise.all([
      this.baseQuery(filter)
        .selectAll()
        .orderBy('ocurrido_en', 'desc')
        .limit(filter.limit)
        .offset(filter.offset)
        .execute(),
      this.baseQuery(filter)
        .select((expression) => expression.fn.countAll<string>().as('total'))
        .executeTakeFirst(),
    ]);

    return {
      items: rows.map((row) => this.map(row)),
      total: Number(total?.total ?? 0),
    };
  }

  async findById(id: string): Promise<AuditRow | null> {
    const row = await this.db
      .selectFrom('evento_auditoria')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? this.map(row) : null;
  }

  private baseQuery(filter: AuditFilter) {
    let query = this.db.selectFrom('evento_auditoria');

    if (filter.from) {
      query = query.where('ocurrido_en', '>=', filter.from);
    }
    if (filter.to) {
      query = query.where('ocurrido_en', '<=', filter.to);
    }
    if (filter.actorId) {
      query = query.where('actor_id', '=', filter.actorId);
    }
    if (filter.recurso) {
      query = query.where('recurso', '=', filter.recurso);
    }
    if (filter.recursoId) {
      query = query.where('recurso_id', '=', filter.recursoId);
    }
    if (filter.accion) {
      query = query.where('accion', '=', filter.accion);
    }

    return query;
  }

  private map(row: {
    id: string;
    actor_id: string | null;
    actor_perfil: string | null;
    ip: string | null;
    dispositivo: string | null;
    recurso: string;
    recurso_id: string | null;
    accion: string;
    datos_antes: unknown;
    datos_despues: unknown;
    ocurrido_en: Date;
    request_id: string | null;
  }): AuditRow {
    return {
      id: row.id,
      actorId: row.actor_id,
      actorPerfil: row.actor_perfil,
      ip: row.ip,
      dispositivo: row.dispositivo,
      recurso: row.recurso,
      recursoId: row.recurso_id,
      accion: row.accion,
      datosAntes: row.datos_antes,
      datosDespues: row.datos_despues,
      ocurridoEn: row.ocurrido_en,
      requestId: row.request_id,
    };
  }
}
