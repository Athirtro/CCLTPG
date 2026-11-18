import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import { requireMigratorDatabaseUrl } from '../../shared/config/env.js';
import {
  MIGRATION_SCHEMAS,
  type MigrationSchema,
  createMigrator,
  isMigrationSchema,
} from './migrator-setup.js';

type Command = 'up' | 'down' | 'status';

const COMMANDS: readonly Command[] = ['up', 'down', 'status'];

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

function parseCommand(value: string | undefined): Command {
  if (value && (COMMANDS as readonly string[]).includes(value)) {
    return value as Command;
  }
  throw new Error(`Comando inválido: "${value ?? ''}". Use up, down o status.`);
}

function parseTarget(value: string | undefined): MigrationSchema[] {
  if (!value || value === 'all') {
    return [...MIGRATION_SCHEMAS];
  }
  if (isMigrationSchema(value)) {
    return [value];
  }
  throw new Error(`Esquema inválido: "${value}". Use public, academic o all.`);
}

async function run(): Promise<void> {
  const command = parseCommand(process.argv[2]);
  const schemas = parseTarget(process.argv[3]);

  if (command === 'down' && schemas.length > 1) {
    throw new Error('La reversión exige un esquema explícito: down public | down academic.');
  }

  const db = new Kysely<unknown>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString: requireMigratorDatabaseUrl(),
        max: 1,
        application_name: 'ccltpg-migrator',
        connectionTimeoutMillis: 5_000,
      }),
    }),
  });

  let failed = false;

  try {
    for (const schema of schemas) {
      const migrator = createMigrator(db, schema);
      write(`\n[${schema}] ${command}`);

      if (command === 'status') {
        const migrations = await migrator.getMigrations();
        if (migrations.length === 0) {
          write('  (sin migraciones)');
        }
        for (const migration of migrations) {
          const state = migration.executedAt
            ? `aplicada ${migration.executedAt.toISOString()}`
            : 'pendiente';
          write(`  ${migration.name}: ${state}`);
        }
        continue;
      }

      const result =
        command === 'up' ? await migrator.migrateToLatest() : await migrator.migrateDown();

      for (const item of result.results ?? []) {
        write(`  ${item.direction} ${item.migrationName}: ${item.status}`);
      }

      if (result.results?.length === 0 || result.results === undefined) {
        write('  (nada por ejecutar)');
      }

      if (result.error) {
        failed = true;
        const error: unknown = result.error;
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'fallo sin detalle';
        write(`  ERROR: ${message}`);
      }
    }
  } finally {
    await db.destroy();
  }

  if (failed) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Migrador: ${message}\n`);
  process.exitCode = 1;
});
