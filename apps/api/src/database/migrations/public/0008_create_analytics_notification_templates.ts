import { sql, type Kysely } from 'kysely';

/**
 * Plantillas de notificación académica de C6 (RB1-57 / D85).
 *
 * Los eventos se incorporaron mediante la enmienda controlada
 * `docs/contratos/cambios/cambio-eventos-c6.md`; el catálogo congelado no se
 * modifica. `evaluacion.publicada` es crítico por prefijo y `recordatorio.fechas`
 * respeta preferencias.
 */
const TEMPLATES: readonly {
  id: string;
  codigo: string;
  canal: 'app' | 'email';
  asunto: string;
  cuerpo: string;
}[] = [
  {
    id: '00000000-0000-4000-8000-000000000119',
    codigo: 'evaluacion.publicada',
    canal: 'app',
    asunto: 'Nueva evaluación publicada',
    cuerpo: 'Se publicó una evaluación cualitativa de tu matrícula.',
  },
  {
    id: '00000000-0000-4000-8000-000000000120',
    codigo: 'evaluacion.publicada',
    canal: 'email',
    asunto: 'Nueva evaluación publicada',
    cuerpo: 'Se publicó una evaluación cualitativa de tu matrícula.',
  },
  {
    id: '00000000-0000-4000-8000-000000000121',
    codigo: 'recordatorio.fechas',
    canal: 'app',
    asunto: 'Próxima sesión de clase',
    cuerpo: 'Tu grupo tiene una sesión programada en los próximos días.',
  },
  {
    id: '00000000-0000-4000-8000-000000000122',
    codigo: 'recordatorio.fechas',
    canal: 'email',
    asunto: 'Próxima sesión de clase',
    cuerpo: 'Tu grupo tiene una sesión programada en los próximos días.',
  },
];

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
  const seedDb = db as unknown as Kysely<PlantillaSeedTable>;
  await seedDb
    .insertInto('plantilla_notificacion')
    .values(TEMPLATES.map((template) => ({ ...template, version: 1 })))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    delete from public.plantilla_notificacion
    where id in (
      '00000000-0000-4000-8000-000000000119',
      '00000000-0000-4000-8000-000000000120',
      '00000000-0000-4000-8000-000000000121',
      '00000000-0000-4000-8000-000000000122'
    )
  `.execute(db);
}
