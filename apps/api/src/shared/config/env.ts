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

  // Autenticación (C2). Los secretos son obligatorios en producción; en
  // desarrollo y pruebas se usan valores locales marcados como no aptos.
  JWT_SECRET_CURRENT: z.string().min(32).optional(),
  JWT_SECRET_PREVIOUS: z.string().min(32).optional(),
  JWT_KID_CURRENT: z.string().min(1).default('ccltpg-2026-01'),
  JWT_KID_PREVIOUS: z.string().min(1).optional(),
  JWT_ISSUER: z.string().min(1).default('ccltpg'),
  JWT_AUDIENCE: z.string().min(1).default('ccltpg-api'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(31_536_000).default(604_800),
  PARTIAL_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(300),
  MFA_ENCRYPTION_KEY: z.string().min(32).optional(),
  EMAIL_HMAC_KEY: z.string().min(32).optional(),
  MFA_ISSUER: z.string().min(1).default('CCLTPG'),
  AUTH_RATE_LIMIT_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),

  // Archivos y almacenamiento de objetos (C3). El adaptador local permite
  // evidencia sin MinIO; S3 se activa con OBJECT_STORAGE_DRIVER=s3.
  OBJECT_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  OBJECT_STORAGE_ENDPOINT: z.string().url().optional(),
  OBJECT_STORAGE_BUCKET: z.string().min(1).max(63).default('ccltpg'),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(1).optional(),
  OBJECT_STORAGE_SECRET_KEY: z.string().min(1).optional(),
  OBJECT_STORAGE_REGION: z.string().min(1).default('us-east-1'),
  OBJECT_STORAGE_LOCAL_ROOT: z.string().min(1).default('.data/objects'),
  OBJECT_STORAGE_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
  MAX_FILE_BYTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(50 * 1024 * 1024)
    .default(10 * 1024 * 1024),

  // Idempotencia, outbox y exportaciones (C3).
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().min(60).max(604_800).default(86_400),
  OUTBOX_WORKER_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(20),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(50).default(5),
  EXPORT_MAX_ROWS: z.coerce.number().int().min(1).max(100_000).default(10_000),
  EXPORT_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(50 * 1024 * 1024)
    .default(10 * 1024 * 1024),

  // Canales externos: stubs explícitos hasta C5/C8 (D51, D54).
  EMAIL_DRIVER: z.enum(['stub', 'smtp']).default('stub'),
  ANTIVIRUS_DRIVER: z.enum(['stub', 'http']).default('stub'),
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

if (raw.OBJECT_STORAGE_DRIVER === 's3') {
  const missing = [
    ['OBJECT_STORAGE_ENDPOINT', raw.OBJECT_STORAGE_ENDPOINT],
    ['OBJECT_STORAGE_ACCESS_KEY', raw.OBJECT_STORAGE_ACCESS_KEY],
    ['OBJECT_STORAGE_SECRET_KEY', raw.OBJECT_STORAGE_SECRET_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`OBJECT_STORAGE_DRIVER=s3 exige: ${missing.join(', ')}.`);
  }
}

// Los adaptadores externos reales llegan en C5/C8. Fallar al arrancar evita
// creer que se está enviando correo o analizando archivos cuando no es así.
if (raw.EMAIL_DRIVER !== 'stub') {
  throw new Error('EMAIL_DRIVER distinto de "stub" no está implementado en C3.');
}

if (raw.ANTIVIRUS_DRIVER !== 'stub') {
  throw new Error('ANTIVIRUS_DRIVER distinto de "stub" no está implementado en C3.');
}

/**
 * Secretos locales de desarrollo. Nunca se aceptan en producción: allí las
 * variables son obligatorias y el arranque falla si faltan (C-24).
 */
const DEV_SECRET = 'ccltpg-dev-only-secret-change-me-0000000000';

function resolveSecret(name: string, value: string | undefined): string {
  if (value) {
    return value;
  }

  if (raw.NODE_ENV === 'production') {
    throw new Error(`${name} es obligatoria en producción.`);
  }

  return DEV_SECRET;
}

if (Boolean(raw.JWT_SECRET_PREVIOUS) !== Boolean(raw.JWT_KID_PREVIOUS)) {
  throw new Error('JWT_SECRET_PREVIOUS y JWT_KID_PREVIOUS deben definirse juntas.');
}

export const env = {
  ...raw,
  corsOrigins,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  JWT_SECRET_CURRENT: resolveSecret('JWT_SECRET_CURRENT', raw.JWT_SECRET_CURRENT),
  JWT_SECRET_PREVIOUS: raw.JWT_SECRET_PREVIOUS ?? null,
  JWT_KID_PREVIOUS: raw.JWT_KID_PREVIOUS ?? null,
  MFA_ENCRYPTION_KEY: resolveSecret('MFA_ENCRYPTION_KEY', raw.MFA_ENCRYPTION_KEY),
  EMAIL_HMAC_KEY: resolveSecret('EMAIL_HMAC_KEY', raw.EMAIL_HMAC_KEY),
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
