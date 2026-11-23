import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';

import { RedisKpiCache } from './redis-kpi.cache.js';

/** D84: un fallo de Redis degrada a consulta directa, nunca a error al usuario. */

function failingRedis(): Redis {
  return {
    get: vi.fn(() => Promise.reject(new Error('connection refused'))),
    set: vi.fn(() => Promise.reject(new Error('connection refused'))),
    incr: vi.fn(() => Promise.reject(new Error('connection refused'))),
  } as unknown as Redis;
}

describe('RedisKpiCache — degradación (C6)', () => {
  it('devuelve null y no propaga errores de Redis', async () => {
    const cache = new RedisKpiCache(failingRedis());
    await expect(cache.get<number[]>('clave')).resolves.toBeNull();
    await expect(cache.set('clave', [1], 60)).resolves.toBeUndefined();
    await expect(cache.invalidateAll()).resolves.toBeUndefined();
  });
});
