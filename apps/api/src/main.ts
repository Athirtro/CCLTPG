import './shared/observability/instrumentation.js';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as PinoNestLogger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap/configure-app.js';
import { env } from './shared/config/env.js';
import { metricsMiddleware } from './shared/observability/metrics.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  app.useLogger(app.get(PinoNestLogger));

  // Antes de CORS: las solicitudes rechazadas también se cuentan.
  app.use(metricsMiddleware);
  configureApp(app);
  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');
  app.get(PinoNestLogger).log(`API escuchando en http://localhost:${env.PORT}${env.API_PREFIX}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Fallo al iniciar la API:', error);
  process.exitCode = 1;
});
