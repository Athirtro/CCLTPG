import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { loggerModuleOptions } from './shared/observability/logger.config.js';

@Module({
  imports: [LoggerModule.forRoot(loggerModuleOptions), DatabaseModule, HealthModule, MetricsModule],
})
export class AppModule {}
