import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Kysely } from 'kysely';
import type { Migration, MigrationProvider } from 'kysely/migration';
import { Migrator } from 'kysely/migration';

export const MIGRATION_SCHEMAS = ['public', 'academic'] as const;

export type MigrationSchema = (typeof MIGRATION_SCHEMAS)[number];

const MIGRATION_FILE_PATTERN = /\.(?:js|mjs|cjs|ts|mts|cts)$/;

export function resolveMigrationFolder(schema: MigrationSchema): string {
  return path.join(import.meta.dirname, '..', 'migrations', schema);
}

/**
 * `FileMigrationProvider` de Kysely hace `import()` sobre una ruta absoluta.
 * En Windows/ESM eso falla (`ERR_UNSUPPORTED_ESM_URL_SCHEME`), así que se
 * convierte a `file://` antes de importar. Se ignoran `.d.ts` y archivos que
 * no exporten `up`/`down`.
 */
class FileUrlMigrationProvider implements MigrationProvider {
  constructor(private readonly folder: string) {}

  async getMigrations(): Promise<Record<string, Migration>> {
    const entries = await fs.readdir(this.folder);
    const migrations: Record<string, Migration> = {};

    for (const entry of entries.sort()) {
      if (!MIGRATION_FILE_PATTERN.test(entry) || entry.endsWith('.d.ts')) {
        continue;
      }

      const fileUrl = pathToFileURL(path.join(this.folder, entry)).href;
      const module: unknown = await import(fileUrl);

      if (
        typeof module !== 'object' ||
        module === null ||
        typeof (module as Migration).up !== 'function' ||
        typeof (module as Migration).down !== 'function'
      ) {
        throw new Error(`La migración "${entry}" debe exportar up y down.`);
      }

      migrations[path.basename(entry, path.extname(entry))] = module as Migration;
    }

    return migrations;
  }
}

/**
 * Cada esquema tiene su propio historial y su propio candado
 * (`<schema>.kysely_migration`), de modo que una migración de `academic`
 * nunca toca el historial de `public`.
 */
export function createMigrator(
  db: Kysely<unknown>,
  schema: MigrationSchema,
  folder: string = resolveMigrationFolder(schema),
): Migrator {
  const provider: MigrationProvider = new FileUrlMigrationProvider(folder);

  return new Migrator({
    db,
    provider,
    migrationTableName: 'kysely_migration',
    migrationLockTableName: 'kysely_migration_lock',
    // Kysely aplica este esquema a la tabla de historial y al candado.
    migrationTableSchema: schema,
  });
}

export function isMigrationSchema(value: string): value is MigrationSchema {
  return (MIGRATION_SCHEMAS as readonly string[]).includes(value);
}
