import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { loggerModuleOptions } from './shared/observability/logger.config.js';

@Module({
  imports: [
    LoggerModule.forRoot(loggerModuleOptions),
    DatabaseModule,
    AuditModule,
    IdentityModule,
    HealthModule,
    MetricsModule,
  ],
})
export class AppModule {}
