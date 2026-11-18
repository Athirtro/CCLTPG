import { describe, expect, it } from 'vitest';

import type { ReadinessReport } from './client';
import { summarize, toHealthRows } from './health';

const healthy: ReadinessReport = {
  status: 'ok',
  checks: {
    database: { status: 'up', latencyMs: 3 },
    redis: { status: 'up', latencyMs: 1 },
  },
  checkedAt: '2026-11-17T10:00:00.000Z',
};

describe('estado del sistema', () => {
  it('traduce las dependencias a filas legibles', () => {
    expect(toHealthRows(healthy)).toEqual([
      { name: 'database', label: 'PostgreSQL', status: 'up', latencyMs: 3 },
      { name: 'redis', label: 'Redis', status: 'up', latencyMs: 1 },
    ]);
  });

  it('resume un sistema sano', () => {
    expect(summarize(healthy)).toEqual({ label: 'Sistema operativo', severity: 'success' });
  });

  it('resume un sistema degradado', () => {
    expect(
      summarize({
        ...healthy,
        status: 'unavailable',
        checks: { ...healthy.checks, redis: { status: 'down', latencyMs: 2000 } },
      }),
    ).toEqual({ label: 'Sistema degradado', severity: 'error' });
  });
});
