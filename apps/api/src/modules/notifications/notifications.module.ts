import { Module } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../database/database.module.js';
import type { Database } from '../../database/schema.js';
import { NotificationsController } from './api/notifications.controller.js';
import { NotificationDispatcher } from './application/notification-dispatcher.js';
import { NotificationsService } from './application/notifications.service.js';
import { NotificationRepository } from './application/ports/notification.repository.js';
import { NotificationsUnitOfWork } from './application/ports/unit-of-work.js';
import { KyselyNotificationRepository } from './infrastructure/persistence/kysely-notification.repository.js';
import { KyselyNotificationsUnitOfWork } from './infrastructure/persistence/kysely-unit-of-work.js';
import { OutboxWorker } from './infrastructure/outbox-worker.js';

@Module({
  controllers: [NotificationsController],
  providers: [
    {
      provide: NotificationRepository,
      useFactory: (db: Kysely<Database>) => new KyselyNotificationRepository(db),
      inject: [DATABASE],
    },
    { provide: NotificationsUnitOfWork, useClass: KyselyNotificationsUnitOfWork },
    NotificationsService,
    NotificationDispatcher,
    OutboxWorker,
  ],
})
export class NotificationsModule {}
