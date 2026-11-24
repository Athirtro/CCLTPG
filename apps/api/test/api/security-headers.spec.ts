import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { configureApp, hstsOptions } from '../../src/bootstrap/configure-app.js';
import { DATABASE, REDIS } from '../../src/database/database.module.js';
import type { ProblemDetails } from '../../src/shared/errors/problem-details.js';
import { REDACT_PATHS } from '../../src/shared/observability/logger.config.js';
import { metricsMiddleware } from '../../src/shared/observability/metrics.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';

const fakeDatabase = {
  executeQuery: vi.fn().mockResolvedValue({ rows: [{ ok: 1 }] }),
  getExecutor: () => ({
    transformQuery: (node: unknown) => node,
    compileQuery: (node: unknown) => ({ sql: 'select 1', parameters: [], query: node }),
    executeQuery: fakeDatabase.executeQuery,
  }),
  destroy: vi.fn().mockResolvedValue(undefined),
};

const fakeRedis = {
  status: 'ready',
  ping: vi.fn().mockResolvedValue('PONG'),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
};

describe('línea base HTTP: cabeceras, CORS, límites y métricas (C-36/C-37/C-45)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE)
      .useValue(fakeDatabase)
      .overrideProvider(REDIS)
      .useValue(fakeRedis)
      .compile();

    const nestApp = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    nestApp.use(metricsMiddleware);
    configureApp(nestApp);
    await nestApp.init();

    app = nestApp;
    server = nestApp.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('incluye cabeceras de seguridad y no revela X-Powered-By', async () => {
    const response = await request(server).get('/api/v1/health/live').expect(200);

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(response.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(response.headers['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );
    expect(response.headers['content-security-policy']).toBe(
      [
        "default-src 'none'",
        "base-uri 'none'",
        "font-src 'self'",
        "form-action 'none'",
        "frame-ancestors 'none'",
        "img-src 'self' data: blob:",
        "object-src 'none'",
        "script-src 'self'",
        "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline'",
        'upgrade-insecure-requests',
        "connect-src 'none'",
      ].join(';'),
    );
    expect(response.headers['content-security-policy']).not.toContain('unsafe-eval');
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('configura HSTS solo en producción (C-20)', () => {
    expect(hstsOptions(false)).toBe(false);
    expect(hstsOptions(true)).toEqual({
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    });
  });

  it('acepta un Origin de la allowlist y devuelve credenciales CORS', async () => {
    const response = await request(server)
      .get('/api/v1/health/live')
      .set('Origin', ALLOWED_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['vary']).toContain('Origin');
  });

  it('rechaza con 403 un Origin no permitido (C-37)', async () => {
    const response = await request(server)
      .get('/api/v1/health/live')
      .set('Origin', 'http://origen-no-permitido.example')
      .expect(403)
      .expect('Content-Type', /application\/problem\+json/);

    const body = response.body as ProblemDetails;
    expect(body.code).toBe('CORS_ORIGIN_DENIED');
    expect(body.instance).toBe('/api/v1/health/live');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rechaza también el preflight de un Origin no permitido', async () => {
    await request(server)
      .options('/api/v1/health/live')
      .set('Origin', 'http://origen-no-permitido.example')
      .set('Access-Control-Request-Method', 'GET')
      .expect(403);
  });

  it('responde 413 si el cuerpo supera BODY_LIMIT', async () => {
    const oversized = JSON.stringify({ data: 'x'.repeat(1_200_000) });

    await request(server)
      .post('/api/v1/health/live')
      .set('Content-Type', 'application/json')
      .send(oversized)
      .expect(413);
  });

  it('expone métricas Prometheus fuera del prefijo /api/v1', async () => {
    await request(server).get('/api/v1/health/live').expect(200);

    const response = await request(server).get('/metrics').expect(200);
    expect(response.text).toContain('ccltpg_http_requests_total');
    expect(response.text).toContain('ccltpg_http_request_duration_seconds');

    await request(server).get('/api/v1/metrics').expect(404);
  });

  it('redacta PII y secretos en los logs (C-40)', () => {
    const lines: string[] = [];
    const stream = { write: (line: string) => lines.push(line) };
    const logger = pino({ redact: { paths: REDACT_PATHS, remove: true } }, stream);

    logger.info(
      {
        req: {
          headers: { authorization: 'Bearer secreto', cookie: '__Host-sesion=abc' },
          body: {
            email: 'persona@example.org',
            password: 'placeholder-password',
            numeroDocumento: '123456789',
          },
        },
        user: { email: 'persona@example.org' },
      },
      'solicitud',
    );

    const output = lines.join('\n');
    expect(output).not.toContain('persona@example.org');
    expect(output).not.toContain('ClaveSuperSecreta');
    expect(output).not.toContain('123456789');
    expect(output).not.toContain('Bearer secreto');
    expect(output).not.toContain('__Host-sesion=abc');
  });
});
