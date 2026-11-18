import { trace } from '@opentelemetry/api';
import type { Params } from 'nestjs-pino';

import { env } from '../config/env.js';
import { resolveRequestId } from './request-id.js';

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.code',
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.body.sessionToken',
  'req.body.email',
  'req.body.numeroDocumento',
  'req.body.numero_documento',
  'req.body.telefono',
  'req.body.direccion',
  'req.body.nombres',
  'req.body.apellidos',
  '*.email',
  '*.numeroDocumento',
  '*.telefono',
  '*.direccion',
];

export const loggerModuleOptions: Params = {
  pinoHttp: {
    level: env.LOG_LEVEL,
    genReqId: (request, response) => {
      const id = resolveRequestId(request.headers['x-request-id']);
      response.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: {
      ignore: (request) => {
        const url = request.url ?? '';
        return url.endsWith('/health/live') || url.endsWith('/health/ready');
      },
    },
    redact: {
      paths: REDACT_PATHS,
      remove: true,
    },
    mixin: () => {
      const span = trace.getActiveSpan();
      if (!span) {
        return {};
      }

      const context = span.spanContext();
      return { traceId: context.traceId, spanId: context.spanId };
    },
    serializers: {
      // Serializadores propios: nunca se registran cabeceras completas, cuerpos ni cookies.
      req: (request: { id?: string; method?: string; url?: string; remoteAddress?: string }) => ({
        id: request.id,
        method: request.method,
        url: request.url,
        remoteAddress: request.remoteAddress,
      }),
      res: (response: { statusCode?: number }) => ({
        statusCode: response.statusCode,
      }),
    },
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:standard' } }
        : undefined,
  },
};
