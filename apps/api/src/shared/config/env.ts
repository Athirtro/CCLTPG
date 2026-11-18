import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv({ path: ['.env', '../../.env'], quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_PREFIX: z
    .string()
    .regex(/^\/[a-z0-9/_-]*$/i, 'API_PREFIX debe empezar por / y usar minúsculas')
    .default('/api/v1'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://ccltpg_app:change_me_local_only@localhost:5432/ccltpg'),
  DATABASE_MIGRATOR_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  BODY_LIMIT: z.string().min(2).default('1mb'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  HEALTH_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(2_000),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  OTEL_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  OTEL_SERVICE_NAME: z.string().min(1).default('ccltpg-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318/v1/traces'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Configuración de entorno inválida: ${issues}`);
}

const raw = parsed.data;

if (raw.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL es obligatoria en producción.');
}

const corsOrigins = raw.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

if (corsOrigins.includes('*') && raw.NODE_ENV === 'production') {
  throw new Error('CORS_ORIGINS no puede ser "*" en producción.');
}

export const env = {
  ...raw,
  corsOrigins,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
};

export type Env = typeof env;

/**
 * URL con el rol de migraciones. En desarrollo cae al valor local de Compose;
 * en producción/test debe declararse explícitamente.
 */
export function requireMigratorDatabaseUrl(): string {
  if (raw.DATABASE_MIGRATOR_URL) {
    return raw.DATABASE_MIGRATOR_URL;
  }

  if (raw.NODE_ENV === 'production') {
    throw new Error('DATABASE_MIGRATOR_URL es obligatoria en producción.');
  }

  return 'postgresql://ccltpg_migrator:change_me_local_only@localhost:5432/ccltpg';
}
