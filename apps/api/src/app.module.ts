import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { ExportsModule } from './modules/exports/exports.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { EmailModule } from './shared/email/email.module.js';
import { MalwareModule } from './shared/malware/malware.module.js';
import { StorageModule } from './shared/storage/storage.module.js';
import { loggerModuleOptions } from './shared/observability/logger.config.js';

@Module({
  imports: [
    LoggerModule.forRoot(loggerModuleOptions),
    DatabaseModule,
    StorageModule,
    MalwareModule,
    EmailModule,
    AuditModule,
    IdentityModule,
    FilesModule,
    NotificationsModule,
    ExportsModule,
    HealthModule,
    MetricsModule,
  ],
})
export class AppModule {}
