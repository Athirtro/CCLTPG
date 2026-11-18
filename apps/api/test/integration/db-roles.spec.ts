import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migratorUrl = process.env.DATABASE_MIGRATOR_URL;
const appUrl = process.env.DATABASE_URL;
const readonlyUrl = process.env.DATABASE_READONLY_URL;
const hasDatabase = Boolean(migratorUrl && appUrl && readonlyUrl);

async function expectWriteDenied(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    expect(typeof code).toBe('string');
    expect(['42501', '25006']).toContain(code);
    return;
  }

  throw new Error('Se esperaba una denegación de escritura y la operación tuvo éxito.');
}

describe.runIf(hasDatabase)('Roles de base con privilegios mínimos (C-41)', () => {
  let migrator: Client;
  let app: Client;
  let readonly: Client;

  beforeAll(async () => {
    migrator = new Client({ connectionString: migratorUrl });
    app = new Client({ connectionString: appUrl });
    readonly = new Client({ connectionString: readonlyUrl });

    await Promise.all([migrator.connect(), app.connect(), readonly.connect()]);
    await migrator.query('drop table if exists public.role_probe');
    await migrator.query('create table public.role_probe (id integer primary key)');
  });

  afterAll(async () => {
    await migrator.query('drop table if exists public.role_probe').catch(() => undefined);
    await Promise.all([migrator.end(), app.end(), readonly.end()]);
  });

  it('el rol de aplicación no puede ejecutar DDL', async () => {
    await expectWriteDenied(() => app.query('create table public.app_ddl_probe (id integer)'));
  });

  it('el rol de aplicación puede insertar en tablas creadas por el migrador', async () => {
    await expect(app.query('insert into public.role_probe (id) values (1)')).resolves.toBeDefined();
  });

  it('el rol de solo lectura no puede insertar', async () => {
    await expectWriteDenied(() => readonly.query('insert into public.role_probe (id) values (2)'));
  });

  it('el rol de solo lectura no puede ejecutar DDL', async () => {
    await expectWriteDenied(() =>
      readonly.query('create table public.readonly_ddl_probe (id integer)'),
    );
  });

  it('el rol de lectura tiene transacciones de solo lectura por defecto', async () => {
    const result = await readonly.query<{ transaction_read_only: string }>(
      'show transaction_read_only',
    );
    expect(result.rows[0]?.transaction_read_only).toBe('on');
  });
});
