import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import { env } from '../shared/config/env.js';
import { ProblemDetailsFilter } from '../shared/errors/problem-details.filter.js';
import { PROBLEM_DETAILS_CONTENT_TYPE } from '../shared/errors/problem-details.js';
import { validationExceptionFactory } from '../shared/errors/validation-exception.factory.js';
import { getRequestId } from '../shared/http/request-id.js';

/**
 * Configuración HTTP común a `main.ts` y a las pruebas de contrato.
 * No escucha en un puerto ni registra hooks de apagado.
 */
export function configureApp(app: NestExpressApplication): void {
  app.disable('x-powered-by');

  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  app.setGlobalPrefix(env.API_PREFIX.replace(/^\//, ''), {
    exclude: ['metrics'],
  });

  const allowedOrigins = new Set(env.corsOrigins);

  // C-37: un Origin no permitido se rechaza con Problem Details; no se limita
  // a omitir las cabeceras CORS, porque eso deja la petición "viva" sin control.
  app.use((request: Request, response: Response, next: NextFunction) => {
    const origin = request.headers.origin;

    if (!origin || allowedOrigins.has(origin)) {
      next();
      return;
    }

    response
      .status(403)
      .type(PROBLEM_DETAILS_CONTENT_TYPE)
      .json({
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'El origen de la solicitud no está permitido.',
        instance: request.originalUrl,
        code: 'CORS_ORIGIN_DENIED',
        requestId: getRequestId(request) ?? 'unknown',
      });
  });

  app.enableCors({
    origin: env.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Perfil-Activo',
      'X-Request-Id',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: env.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );
    next();
  });

  app.useBodyParser('json', { limit: env.BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: env.BODY_LIMIT, extended: false });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
}
