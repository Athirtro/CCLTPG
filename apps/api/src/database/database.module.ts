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
import { IDEMPOTENCY_STORE } from '../shared/idempotency/idempotency.port.js';
import type { Database } from './schema.js';
import { KyselyIdempotencyStore } from './idempotency/kysely-idempotency.store.js';

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
    // Conexión eagerly + cola offline: la primera petición después del arranque
    // no debe fallar mientras el socket de Redis todavía se está estableciendo.
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
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
  providers: [
    databaseProvider,
    redisProvider,
    {
      provide: IDEMPOTENCY_STORE,
      useFactory: (db: Kysely<unknown>) => new KyselyIdempotencyStore(db as Kysely<Database>),
      inject: [DATABASE],
    },
  ],
  exports: [DATABASE, REDIS, IDEMPOTENCY_STORE],
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
