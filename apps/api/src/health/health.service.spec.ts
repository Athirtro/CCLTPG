import { describe, expect, it, vi } from 'vitest';
import type { Redis } from 'ioredis';
import type { Kysely } from 'kysely';

import { HealthService } from './health.service.js';

function createDatabase(executeQuery: () => Promise<unknown>): Kysely<unknown> {
  // `sql.execute()` necesita un ejecutor con transformQuery/compileQuery;
  // el resultado de la consulta no se usa más allá de saber que respondió.
  const executor = {
    transformQuery: (node: unknown) => node,
    compileQuery: (node: unknown) => ({ sql: 'select 1', parameters: [], query: node }),
    executeQuery,
  };

  return { getExecutor: () => executor } as unknown as Kysely<unknown>;
}

function createRedis(overrides: Partial<Redis> = {}): Redis {
  return {
    status: 'ready',
    ping: vi.fn().mockResolvedValue('PONG'),
    connect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Redis;
}

describe('HealthService', () => {
  it('reporta liveness con uptime y timestamp', () => {
    const service = new HealthService(
      createDatabase(() => Promise.resolve({ rows: [] })),
      createRedis(),
    );

    const report = service.liveness();

    expect(report.status).toBe('ok');
    expect(report.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(report.timestamp))).toBe(false);
  });

  it('reporta ready cuando la base y Redis responden', async () => {
    const service = new HealthService(
      createDatabase(() => Promise.resolve({ rows: [{ ok: 1 }] })),
      createRedis(),
    );

    const report = await service.readiness();

    expect(report.status).toBe('ok');
    expect(report.checks.database.status).toBe('up');
    expect(report.checks.redis.status).toBe('up');
  });

  it('conecta Redis en modo lazy antes de hacer ping', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const ping = vi.fn().mockResolvedValue('PONG');
    const service = new HealthService(
      createDatabase(() => Promise.resolve({ rows: [] })),
      createRedis({ status: 'wait', connect, ping }),
    );

    const report = await service.readiness();

    expect(connect).toHaveBeenCalledOnce();
    expect(ping).toHaveBeenCalledOnce();
    expect(report.checks.redis.status).toBe('up');
  });

  it('marca unavailable si la base falla y no expone el error', async () => {
    const service = new HealthService(
      createDatabase(() => Promise.reject(new Error('password=secreto'))),
      createRedis(),
    );

    const report = await service.readiness();

    expect(report.status).toBe('unavailable');
    expect(report.checks.database.status).toBe('down');
    expect(JSON.stringify(report)).not.toContain('secreto');
  });

  it('marca unavailable si Redis rechaza el ping', async () => {
    const service = new HealthService(
      createDatabase(() => Promise.resolve({ rows: [] })),
      createRedis({ ping: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) }),
    );

    const report = await service.readiness();

    expect(report.status).toBe('unavailable');
    expect(report.checks.redis.status).toBe('down');
  });

  it('corta la verificación cuando se excede el tiempo límite', async () => {
    vi.useFakeTimers();
    try {
      const service = new HealthService(
        createDatabase(() => new Promise(() => undefined)),
        createRedis(),
      );

      const pending = service.readiness();
      await vi.advanceTimersByTimeAsync(2_000);
      const report = await pending;

      expect(report.checks.database.status).toBe('down');
      expect(report.status).toBe('unavailable');
    } finally {
      vi.useRealTimers();
    }
  });
});
