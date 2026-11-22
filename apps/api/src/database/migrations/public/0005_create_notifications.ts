import { sql, type Kysely } from 'kysely';

/**
 * Migración de notificaciones (C3 — RB1-20/RB1-23).
 *
 * Crea las tablas del diccionario §2.9–2.11:
 * - `plantilla_notificacion` (versionada por `codigo` + `canal`),
 * - `preferencia_notificacion` (única por usuario/evento/canal),
 * - `notificacion` (bandeja y estado de entrega).
 *
 * `evento_id` permite que un evento de la outbox se entregue una sola vez por
 * usuario y canal. Es una propuesta de extensión para Rol A (R-033) y se
 * registra en el paquete de C3.
 */

const TEMPLATE_APP_ID = '00000000-0000-4000-8000-000000000101';
const TEMPLATE_EMAIL_ID = '00000000-0000-4000-8000-000000000102';
const TEMPLATE_REPORT_ID = '00000000-0000-4000-8000-000000000103';
const TEMPLATE_REPORT_EMAIL_ID = '00000000-0000-4000-8000-000000000104';
const TEMPLATE_ENROLLMENT_ID = '00000000-0000-4000-8000-000000000105';
const TEMPLATE_ENROLLMENT_EMAIL_ID = '00000000-0000-4000-8000-000000000106';

interface PlantillaSeedTable {
  plantilla_notificacion: {
    id: string;
    codigo: string;
    canal: 'app' | 'email';
    asunto: string;
    cuerpo: string;
    version: number;
  };
}

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('plantilla_notificacion')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('codigo', 'text', (column) => column.notNull())
    .addColumn('canal', 'text', (column) => column.notNull())
    .addColumn('asunto', 'text', (column) => column.notNull())
    .addColumn('cuerpo', 'text', (column) => column.notNull())
    .addColumn('version', 'integer', (column) => column.notNull().defaultTo(1))
    .addColumn('creado_en', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('plantilla_notificacion_codigo_canal_key', ['codigo', 'canal'])
    .addCheckConstraint('plantilla_notificacion_canal_check', sql`canal in ('app', 'email')`)
    .addCheckConstraint('plantilla_notificacion_version_check', sql`version > 0`)
    .execute();

  await db.schema
    .createTable('notificacion')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('usuario_id', 'uuid', (column) => column.notNull())
    .addColumn('evento', 'text', (column) => column.notNull())
    .addColumn('evento_id', 'uuid')
    .addColumn('canal', 'text', (column) => column.notNull())
    .addColumn('plantilla_id', 'uuid')
    .addColumn('payload', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('estado', 'text', (column) => column.notNull().defaultTo('pendiente'))
    .addColumn('leida_en', 'timestamptz')
    .addColumn('enviada_en', 'timestamptz')
    .addColumn('creado_en', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addForeignKeyConstraint(
      'notificacion_plantilla_id_fkey',
      ['plantilla_id'],
      'plantilla_notificacion',
      ['id'],
      (constraint) => constraint.onDelete('set null'),
    )
    .addUniqueConstraint('notificacion_evento_usuario_canal_key', [
      'evento_id',
      'usuario_id',
      'canal',
    ])
    .addCheckConstraint('notificacion_canal_check', sql`canal in ('app', 'email')`)
    .addCheckConstraint(
      'notificacion_estado_check',
      sql`estado in ('pendiente', 'enviada', 'leida', 'fallida')`,
    )
    .execute();

  await db.schema
    .createIndex('notificacion_usuario_leida_idx')
    .on('notificacion')
    .columns(['usuario_id', 'leida_en'])
    .execute();

  await db.schema
    .createIndex('notificacion_usuario_creado_idx')
    .on('notificacion')
    .columns(['usuario_id', 'creado_en'])
    .execute();

  await db.schema
    .createTable('preferencia_notificacion')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('usuario_id', 'uuid', (column) => column.notNull())
    .addColumn('evento', 'text', (column) => column.notNull())
    .addColumn('canal', 'text', (column) => column.notNull())
    .addColumn('habilitado', 'boolean', (column) => column.notNull().defaultTo(true))
    .addColumn('actualizado_en', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('preferencia_notificacion_usuario_evento_canal_key', [
      'usuario_id',
      'evento',
      'canal',
    ])
    .addCheckConstraint('preferencia_notificacion_canal_check', sql`canal in ('app', 'email')`)
    .execute();

  await db.schema
    .createIndex('preferencia_notificacion_usuario_idx')
    .on('preferencia_notificacion')
    .columns(['usuario_id'])
    .execute();

  // Plantillas mínimas para C3. Los textos no incluyen datos personales: el
  // payload se interpola en el consumidor y se sanea allí.
  const seedDb = db as unknown as Kysely<PlantillaSeedTable>;
  await seedDb
    .insertInto('plantilla_notificacion')
    .values([
      {
        id: TEMPLATE_APP_ID,
        codigo: 'notificacion.generica',
        canal: 'app',
        asunto: 'Nueva notificación',
        cuerpo: 'Tienes una novedad en la plataforma.',
        version: 1,
      },
      {
        id: TEMPLATE_EMAIL_ID,
        codigo: 'notificacion.generica',
        canal: 'email',
        asunto: 'Nueva notificación',
        cuerpo: 'Tienes una novedad en la plataforma.',
        version: 1,
      },
      {
        id: TEMPLATE_REPORT_ID,
        codigo: 'reporte.generado',
        canal: 'app',
        asunto: 'Reporte disponible',
        cuerpo: 'Tu reporte está listo para descargar.',
        version: 1,
      },
      {
        id: TEMPLATE_REPORT_EMAIL_ID,
        codigo: 'reporte.generado',
        canal: 'email',
        asunto: 'Reporte disponible',
        cuerpo: 'Tu reporte está listo para descargar.',
        version: 1,
      },
      {
        id: TEMPLATE_ENROLLMENT_ID,
        codigo: 'matricula.confirmada',
        canal: 'app',
        asunto: 'Matrícula confirmada',
        cuerpo: 'Tu matrícula fue confirmada.',
        version: 1,
      },
      {
        id: TEMPLATE_ENROLLMENT_EMAIL_ID,
        codigo: 'matricula.confirmada',
        canal: 'email',
        asunto: 'Matrícula confirmada',
        cuerpo: 'Tu matrícula fue confirmada.',
        version: 1,
      },
    ])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('preferencia_notificacion_usuario_idx').ifExists().execute();
  await db.schema.dropTable('preferencia_notificacion').ifExists().execute();
  await db.schema.dropIndex('notificacion_usuario_creado_idx').ifExists().execute();
  await db.schema.dropIndex('notificacion_usuario_leida_idx').ifExists().execute();
  await db.schema.dropTable('notificacion').ifExists().execute();
  await db.schema.dropTable('plantilla_notificacion').ifExists().execute();
}
