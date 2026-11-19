import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import { env, requireMigratorDatabaseUrl } from '../../shared/config/env.js';
import type { Database } from '../schema.js';
import { seedIdentity } from './identity.seed.js';

/**
 * `pnpm db:seed` — semilla local de identidad.
 * Exige `DATABASE_MIGRATOR_URL` (rol migrador) y se niega a correr en producción.
 */
async function main(): Promise<void> {
  if (env.isProduction) {
    throw new Error('La semilla de identidad no puede ejecutarse en producción.');
  }

  const connectionString = requireMigratorDatabaseUrl();
  const password = process.env.SEED_PASSWORD ?? 'CambiarEstaClave#2026';
  const withTemporaryIdentity = process.env.SEED_TEMPORAL !== 'false';

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: 2 }) }),
  });

  try {
    const result = await seedIdentity(db, {
      password,
      adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@ccltpg.org',
      withTemporaryIdentity,
    });

    console.warn(
      `Semilla aplicada: ${result.perfiles} perfiles, ${result.permisos} permisos, ${result.usuarios} usuarios.`,
    );
    if (!process.env.SEED_PASSWORD) {
      console.warn(
        'Se usó la contraseña de demostración. Defina SEED_PASSWORD y cambie la clave en el primer acceso.',
      );
    }
  } finally {
    await db.destroy();
  }
}

await main();
