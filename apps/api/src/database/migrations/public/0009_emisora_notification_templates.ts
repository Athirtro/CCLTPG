import { sql, type Kysely } from 'kysely';

/**
 * Plantillas de notificación de Emisora R.A.C. (plan §3 fila 22, B5/EL-4).
 *
 * Única migración aditiva en `public`: inserta solo filas nuevas de
 * `plantilla_notificacion`, donde el dispatcher ya lee las plantillas. El
 * `down` elimina exclusivamente esas filas por `codigo`, sin tocar las 22
 * plantillas previas.
 */
const TEMPLATES: readonly {
  id: string;
  codigo: string;
  canal: 'app' | 'email';
  asunto: string;
  cuerpo: string;
}[] = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    codigo: 'convocatoria.abierta',
    canal: 'app',
    asunto: 'Convocatoria abierta',
    cuerpo: 'La convocatoria anual de projects está abierta.',
  },
  {
    id: '00000000-0000-4000-8000-000000000202',
    codigo: 'convocatoria.abierta',
    canal: 'email',
    asunto: 'Convocatoria abierta',
    cuerpo: 'La convocatoria anual de proyectos está abierta.',
  },
  {
    id: '00000000-0000-4000-8000-000000000203',
    codigo: 'convocatoria.cerrada',
    canal: 'app',
    asunto: 'Convocatoria cerrada',
    cuerpo: 'La convocatoria anual ha cerrado.',
  },
  {
    id: '00000000-0000-4000-8000-000000000204',
    codigo: 'convocatoria.cerrada',
    canal: 'email',
    asunto: 'Convocatoria cerrada',
    cuerpo: 'La convocatoria anual ha cerrado.',
  },
  {
    id: '00000000-0000-4000-8000-000000000205',
    codigo: 'rejilla.aprobada',
    canal: 'app',
    asunto: 'Rejilla anual aprobada',
    cuerpo: 'El comité aprobó la rejilla anual de programación.',
  },
  {
    id: '00000000-0000-4000-8000-000000000206',
    codigo: 'rejilla.aprobada',
    canal: 'email',
    asunto: 'Rejilla anual aprobada',
    cuerpo: 'El comité aprobó la rejilla anual de programación.',
  },
  {
    id: '00000000-0000-4000-8000-000000000207',
    codigo: 'grabacion.programada',
    canal: 'app',
    asunto: 'Grabación programada',
    cuerpo: 'Tienes una sesión de grabación programada.',
  },
  {
    id: '00000000-0000-4000-8000-000000000208',
    codigo: 'grabacion.programada',
    canal: 'email',
    asunto: 'Grabación programada',
    cuerpo: 'Tienes una sesión de grabación programada.',
  },
  {
    id: '00000000-0000-4000-8000-000000000209',
    codigo: 'informe.recibido',
    canal: 'app',
    asunto: 'Informe recibido',
    cuerpo: 'Se recibió el informe del realizador.',
  },
  {
    id: '00000000-0000-4000-8000-000000000210',
    codigo: 'informe.recibido',
    canal: 'email',
    asunto: 'Informe recibido',
    cuerpo: 'Se recibió el informe del realizador.',
  },
  {
    id: '00000000-0000-4000-8000-000000000211',
    codigo: 'incentivo.asignado',
    canal: 'app',
    asunto: 'Incentivo asignado',
    cuerpo: 'Se registró la asignación de un incentivo.',
  },
  {
    id: '00000000-0000-4000-8000-000000000212',
    codigo: 'incentivo.asignado',
    canal: 'email',
    asunto: 'Incentivo asignado',
    cuerpo: 'Se registró la asignación de un incentivo.',
  },
  {
    id: '00000000-0000-4000-8000-000000000213',
    codigo: 'transmision.autorizada',
    canal: 'app',
    asunto: 'Transmisión autorizada',
    cuerpo: 'La transmisión fue autorizada.',
  },
  {
    id: '00000000-0000-4000-8000-000000000214',
    codigo: 'transmision.autorizada',
    canal: 'email',
    asunto: 'Transmisión autorizada',
    cuerpo: 'La transmisión fue autorizada.',
  },
  {
    id: '00000000-0000-4000-8000-000000000215',
    codigo: 'turno.asignado',
    canal: 'app',
    asunto: 'Turno asignado',
    cuerpo: 'Se asignó un turno de operación de transmisor.',
  },
  {
    id: '00000000-0000-4000-8000-000000000216',
    codigo: 'turno.asignado',
    canal: 'email',
    asunto: 'Turno asignado',
    cuerpo: 'Se asignó un turno de operación de transmisor.',
  },
];

export const EMISORA_TEMPLATE_CODES = [...new Set(TEMPLATES.map((template) => template.codigo))];

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
    where codigo in (
      'convocatoria.abierta',
      'convocatoria.cerrada',
      'rejilla.aprobada',
      'grabacion.programada',
      'informe.recibido',
      'incentivo.asignado',
      'transmision.autorizada',
      'turno.asignado'
    )
  `.execute(db);
}
