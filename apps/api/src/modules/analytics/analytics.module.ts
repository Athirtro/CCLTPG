import { Module } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../database/database.module.js';
import type { Database } from '../../database/schema.js';
import { AnalyticsController } from './api/analytics.controller.js';
import { KpiService } from './application/kpi.service.js';
import { KpiCache } from './application/ports/kpi-cache.js';
import { KpiRepository } from './application/ports/kpi.repository.js';
import { KpiCacheInvalidator } from './infrastructure/kpi-cache-invalidator.js';
import { RedisKpiCache } from './infrastructure/redis-kpi.cache.js';
import { KyselyKpiRepository } from './infrastructure/persistence/kysely-kpi.repository.js';

@Module({
  controllers: [AnalyticsController],
  providers: [
    {
      provide: KpiRepository,
      useFactory: (db: Kysely<Database>) => new KyselyKpiRepository(db),
      inject: [DATABASE],
    },
    { provide: KpiCache, useClass: RedisKpiCache },
    KpiService,
    KpiCacheInvalidator,
  ],
})
export class AnalyticsModule {}
