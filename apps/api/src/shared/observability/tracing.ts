import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { NodeSDK } from '@opentelemetry/sdk-node';

import { env } from '../config/env.js';

let sdk: NodeSDK | undefined;

/**
 * Activa trazas OpenTelemetry solo si `OTEL_ENABLED=true`. Se importa antes
 * que NestJS (`instrumentation.ts` es el primer import de `main.ts`) para que
 * las instrumentaciones puedan parchear http, express, pg e ioredis.
 */
export function startTracing(): NodeSDK | undefined {
  if (!env.OTEL_ENABLED) {
    return undefined;
  }

  sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    traceExporter: new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT }),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new PgInstrumentation(),
      new IORedisInstrumentation(),
    ],
  });

  sdk.start();
  return sdk;
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = undefined;
}
