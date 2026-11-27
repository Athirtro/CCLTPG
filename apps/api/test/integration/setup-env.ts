import { config as loadDotenv } from 'dotenv';

/**
 * Aísla la suite de integración de la base de desarrollo.
 *
 * `env.ts` carga el `.env` raíz, que apunta a `ccltpg`. Las pruebas de
 * migración hacen `up → down → up` y borran el esquema, así que redirigimos
 * las tres URLs de base a una base independiente antes de que se importen los
 * specs. `dotenv` no sobrescribe variables ya presentes en `process.env`.
 */
loadDotenv({ path: ['.env', '../../.env'], quiet: true });

const database = process.env.CCLTPG_INTEGRATION_DB ?? 'ccltpg_integration';

for (const name of ['DATABASE_URL', 'DATABASE_MIGRATOR_URL', 'DATABASE_READONLY_URL'] as const) {
  const value = process.env[name];
  if (!value) continue;

  const url = new URL(value);
  url.pathname = `/${database}`;
  process.env[name] = url.toString();
}
