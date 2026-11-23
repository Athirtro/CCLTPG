import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

import { DATABASE } from '../../../database/database.module.js';
import type { Database } from '../../../database/schema.js';
import { env } from '../../../shared/config/env.js';
import { KpiCache } from '../application/ports/kpi-cache.js';

const POLL_INTERVAL_MS = 30_000;
const RELEVANT_ACTIONS = ['matricula.%', 'asistencia.%', 'evaluacion.%'];

/**
 * Invalidación de la caché a partir de eventos de auditoría (D84).
 *
 * La API no publica un bus entre contextos: el productor académico escribe la
 * auditoría en la misma transacción y este observador consulta los eventos
 * nuevos. No importa código de otro contexto, por lo que respeta C-34.
 */
@Injectable()
export class KpiCacheInvalidator implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KpiCacheInvalidator.name);
  private timer: NodeJS.Timeout | null = null;
  private lastSeen = new Date(0);

  constructor(
    @Inject(DATABASE) private readonly db: Kysely<Database>,
    @Inject(KpiCache) private readonly cache: KpiCache,
  ) {}

  onModuleInit(): void {
    if (env.isTest) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<number> {
    const patterns = sql.join(
      RELEVANT_ACTIONS.map((accion) => sql`accion like ${accion}`),
      sql` or `,
    );
    const result = await sql<{ id: string; ocurrido_en: Date }>`
      select id, ocurrido_en
      from public.evento_auditoria
      where (${patterns}) and ocurrido_en > ${this.lastSeen}
      order by ocurrido_en asc
      limit 100
    `.execute(this.db);

    if (result.rows.length === 0) {
      return 0;
    }

    const latest = result.rows[result.rows.length - 1]?.ocurrido_en;
    if (latest) {
      this.lastSeen = latest;
    }
    await this.cache.invalidateAll();
    this.logger.debug(`Caché de KPIs invalidada por ${result.rows.length} evento(s).`);
    return result.rows.length;
  }
}
