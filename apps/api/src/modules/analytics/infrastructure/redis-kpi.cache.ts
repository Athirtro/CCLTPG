import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { REDIS } from '../../../database/database.module.js';
import type { KpiCache } from '../application/ports/kpi-cache.js';

const PREFIX = 'ccltpg:kpi:v1';
const GENERATION_KEY = `${PREFIX}:generation`;
const DEFAULT_TTL_SECONDS = 60;

/**
 * Caché Redis de KPIs (D84).
 *
 * La clave incluye una generación que se incrementa al invalidar. Un fallo de
 * Redis nunca impide responder: se devuelve `null` y el servicio consulta la
 * base directamente (disponibilidad por encima de caché).
 */
@Injectable()
export class RedisKpiCache implements KpiCache {
  private readonly logger = new Logger(RedisKpiCache.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const generation = await this.redis.get(GENERATION_KEY);
      const raw = await this.redis.get(`${PREFIX}:${generation ?? 0}:${key}`);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (error) {
      this.logger.debug(`Fallo de lectura de caché de KPIs: ${safeMessage(error)}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    try {
      const generation = await this.redis.get(GENERATION_KEY);
      await this.redis.set(
        `${PREFIX}:${generation ?? 0}:${key}`,
        JSON.stringify(value),
        'EX',
        ttlSeconds,
      );
    } catch (error) {
      this.logger.debug(`Fallo de escritura de caché de KPIs: ${safeMessage(error)}`);
    }
  }

  async invalidateAll(): Promise<void> {
    try {
      await this.redis.incr(GENERATION_KEY);
    } catch (error) {
      this.logger.debug(`Fallo de invalidación de caché de KPIs: ${safeMessage(error)}`);
    }
  }
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 120) : 'ERROR';
}
