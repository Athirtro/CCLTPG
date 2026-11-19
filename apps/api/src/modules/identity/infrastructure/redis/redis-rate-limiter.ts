import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { REDIS } from '../../../../database/database.module.js';
import { env } from '../../../../shared/config/env.js';
import { AuthError } from '../../application/auth-error.js';
import { RateLimiter, type RateLimitResult } from '../../application/ports/rate-limiter.js';

const PREFIX = 'ccltpg:rate';

@Injectable()
export class RedisRateLimiter implements RateLimiter {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    if (!env.AUTH_RATE_LIMIT_ENABLED) {
      return { allowed: true, retryAfterSeconds: 0, count: 0 };
    }

    const namespaced = `${PREFIX}:${key}`;

    try {
      const count = await this.redis.incr(namespaced);
      if (count === 1) {
        await this.redis.expire(namespaced, windowSeconds);
      }

      const ttl = await this.redis.ttl(namespaced);
      return {
        allowed: count <= limit,
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
        count,
      };
    } catch {
      // Falla cerrada: sin Redis no se puede garantizar el límite.
      throw AuthError.serviceUnavailable();
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.redis.del(`${PREFIX}:${key}`);
    } catch {
      throw AuthError.serviceUnavailable();
    }
  }
}
