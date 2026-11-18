import type { NextFunction, Request, Response } from 'express';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

/**
 * Registro único de métricas Prometheus. Los nombres llevan prefijo `ccltpg_`
 * para no colisionar si en el futuro se comparte un colector.
 */
export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry, prefix: 'ccltpg_' });

export const httpRequestsTotal = new Counter({
  name: 'ccltpg_http_requests_total',
  help: 'Número de solicitudes HTTP por método, ruta y estado.',
  labelNames: ['method', 'route', 'status'],
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'ccltpg_http_request_duration_seconds',
  help: 'Duración de las solicitudes HTTP en segundos.',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

/**
 * Etiqueta de ruta acotada: las rutas no reconocidas se agrupan en
 * `unmatched` para evitar cardinalidad ilimitada desde 404 arbitrarios.
 */
export function routeLabel(request: Request): string {
  const route = request.route as { path?: unknown } | undefined;
  const routePath = route?.path;
  if (typeof routePath !== 'string') {
    return 'unmatched';
  }

  return `${request.baseUrl}${routePath}` || 'unmatched';
}

export function metricsMiddleware(request: Request, response: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  response.on('finish', () => {
    const route = routeLabel(request);
    const labels = {
      method: request.method,
      route,
      status: String(response.statusCode),
    };
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });

  next();
}
