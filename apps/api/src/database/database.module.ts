import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
  type Provider,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import { env } from '../shared/config/env.js';

export const DATABASE = Symbol('CCLTPG_DATABASE');
export const REDIS = Symbol('CCLTPG_REDIS');

const databaseProvider: Provider = {
  provide: DATABASE,
  useFactory: (): Kysely<unknown> =>
    new Kysely<unknown>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({
          connectionString: env.DATABASE_URL,
          max: 10,
          application_name: 'ccltpg-api',
          connectionTimeoutMillis: 5_000,
        }),
      }),
    }),
};

const redisProvider: Provider = {
  provide: REDIS,
  useFactory: (): Redis => {
    const logger = new Logger('Redis');
    const client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3_000,
    });

    client.on('error', (error: Error) => {
      logger.debug(`Error de conexión con Redis: ${error.message}`);
    });

    return client;
  },
};

@Global()
@Module({
  providers: [databaseProvider, redisProvider],
  exports: [DATABASE, REDIS],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE) private readonly database: Kysely<unknown>,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.database.destroy();
    this.redis.disconnect();
  }
}
