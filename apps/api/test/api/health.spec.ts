import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { DATABASE, REDIS } from '../../src/database/database.module.js';
import type { LivenessReport, ReadinessReport } from '../../src/health/health.service.js';
import type { ProblemDetails } from '../../src/shared/errors/problem-details.js';
import { ProblemDetailsFilter } from '../../src/shared/errors/problem-details.filter.js';

const UUID_V4 = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const fakeDatabase = {
  executeQuery: vi.fn(),
  getExecutor: () => ({
    transformQuery: (node: unknown) => node,
    compileQuery: (node: unknown) => ({ sql: 'select 1', parameters: [], query: node }),
    executeQuery: fakeDatabase.executeQuery,
  }),
  destroy: vi.fn().mockResolvedValue(undefined),
};

const fakeRedis = {
  status: 'ready',
  ping: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
};

function bodyOf<T>(response: { body: unknown }): T {
  return response.body as T;
}

describe('API — contrato base de salud y errores', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE)
      .useValue(fakeDatabase)
      .overrideProvider(REDIS)
      .useValue(fakeRedis)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(() => {
    fakeDatabase.executeQuery.mockReset();
    fakeDatabase.executeQuery.mockResolvedValue({ rows: [{ ok: 1 }] });
    fakeRedis.status = 'ready';
    fakeRedis.ping.mockReset();
    fakeRedis.ping.mockResolvedValue('PONG');
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live responde 200 con requestId', async () => {
    const response = await request(server)
      .get('/api/v1/health/live')
      .set('X-Request-Id', UUID_V4)
      .expect(200);

    const body = bodyOf<LivenessReport & { requestId: string | null }>(response);
    expect(body.status).toBe('ok');
    expect(body.requestId).toBe(UUID_V4);
    expect(response.headers['x-request-id']).toBe(UUID_V4);
  });

  it('GET /health/ready responde 200 si las dependencias están arriba', async () => {
    const response = await request(server).get('/api/v1/health/ready').expect(200);

    const body = bodyOf<ReadinessReport & { requestId: string | null }>(response);
    expect(body.status).toBe('ok');
    expect(body.checks.database).toMatchObject({ status: 'up' });
    expect(body.checks.redis).toMatchObject({ status: 'up' });
    expect(typeof body.requestId).toBe('string');
  });

  it('GET /health/ready responde 503 en Problem Details si Redis está caído', async () => {
    fakeRedis.ping.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:6379'));

    const response = await request(server)
      .get('/api/v1/health/ready')
      .expect(503)
      .expect('Content-Type', /application\/problem\+json/);

    const body = bodyOf<ProblemDetails>(response);
    expect(body).toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(body.detail).toContain('redis');
    expect(body.detail).not.toContain('ECONNREFUSED');
    expect(typeof body.requestId).toBe('string');
  });

  it('una ruta inexistente responde 404 en Problem Details', async () => {
    const response = await request(server)
      .get('/api/v1/no-existe')
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/);

    const body = bodyOf<ProblemDetails>(response);
    expect(body).toMatchObject({
      type: 'about:blank',
      status: 404,
      code: 'RESOURCE_NOT_FOUND',
      instance: '/api/v1/no-existe',
    });
  });

  it('reemplaza un X-Request-Id inválido por un UUID generado', async () => {
    const response = await request(server)
      .get('/api/v1/health/live')
      .set('X-Request-Id', 'no-es-un-uuid')
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const body = bodyOf<LivenessReport & { requestId: string | null }>(response);
    expect(body.requestId).toBe(response.headers['x-request-id']);
  });
});
