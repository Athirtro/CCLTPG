import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { type Kysely, sql } from 'kysely';

import { DATABASE, REDIS } from '../database/database.module.js';
import { env } from '../shared/config/env.js';

export type DependencyState = 'up' | 'down';

export interface DependencyCheck {
  status: DependencyState;
  latencyMs: number;
}

export interface LivenessReport {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessReport {
  status: 'ok' | 'unavailable';
  checks: {
    database: DependencyCheck;
    redis: DependencyCheck;
  };
  checkedAt: string;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  // Evita unhandled rejection si el timeout gana la carrera.
  promise.catch(() => undefined);

  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('HEALTH_CHECK_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DATABASE) private readonly database: Kysely<unknown>,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  liveness(): LivenessReport {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<ReadinessReport> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const healthy = database.status === 'up' && redis.status === 'up';

    return {
      status: healthy ? 'ok' : 'unavailable',
      checks: { database, redis },
      checkedAt: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    return this.measure(async () => {
      await sql`select 1`.execute(this.database);
    });
  }

  private async checkRedis(): Promise<DependencyCheck> {
    return this.measure(async () => {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }
      await this.redis.ping();
    });
  }

  private async measure(action: () => Promise<unknown>): Promise<DependencyCheck> {
    const startedAt = performance.now();

    try {
      await withTimeout(action(), env.HEALTH_TIMEOUT_MS);
      return { status: 'up', latencyMs: Math.round(performance.now() - startedAt) };
    } catch {
      return { status: 'down', latencyMs: Math.round(performance.now() - startedAt) };
    }
  }
}
