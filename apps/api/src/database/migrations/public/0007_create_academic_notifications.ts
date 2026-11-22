import { sql, type Kysely } from 'kysely';

/**
 * Plantillas de notificación académica (C4 — RB1-34).
 *
 * `matricula.confirmada` ya existe desde C3. Se añaden las plantillas de los
 * demás estados y de `horario.modificado`. Los eventos son críticos (D67): no
 * se pueden silenciar.
 */
const TEMPLATES: readonly {
  id: string;
  codigo: string;
  canal: 'app' | 'email';
  asunto: string;
  cuerpo: string;
}[] = [
  {
    id: '00000000-0000-4000-8000-000000000107',
    codigo: 'matricula.creada',
    canal: 'app',
    asunto: 'Matrícula registrada',
    cuerpo: 'Tu matrícula fue registrada y está pendiente de confirmación.',
  },
  {
    id: '00000000-0000-4000-8000-000000000108',
    codigo: 'matricula.creada',
    canal: 'email',
    asunto: 'Matrícula registrada',
    cuerpo: 'Tu matrícula fue registrada y está pendiente de confirmación.',
  },
  {
    id: '00000000-0000-4000-8000-000000000109',
    codigo: 'matricula.cancelada',
    canal: 'app',
    asunto: 'Matrícula cancelada',
    cuerpo: 'Tu matrícula fue cancelada.',
  },
  {
    id: '00000000-0000-4000-8000-000000000110',
    codigo: 'matricula.cancelada',
    canal: 'email',
    asunto: 'Matrícula cancelada',
    cuerpo: 'Tu matrícula fue cancelada.',
  },
  {
    id: '00000000-0000-4000-8000-000000000111',
    codigo: 'matricula.activada',
    canal: 'app',
    asunto: 'Matrícula activa',
    cuerpo: 'Tu matrícula está activa. ¡Bienvenido al programa!',
  },
  {
    id: '00000000-0000-4000-8000-000000000112',
    codigo: 'matricula.activada',
    canal: 'email',
    asunto: 'Matrícula activa',
    cuerpo: 'Tu matrícula está activa. ¡Bienvenido al programa!',
  },
  {
    id: '00000000-0000-4000-8000-000000000113',
    codigo: 'matricula.finalizada',
    canal: 'app',
    asunto: 'Matrícula finalizada',
    cuerpo: 'Tu matrícula fue finalizada.',
  },
  {
    id: '00000000-0000-4000-8000-000000000114',
    codigo: 'matricula.finalizada',
    canal: 'email',
    asunto: 'Matrícula finalizada',
    cuerpo: 'Tu matrícula fue finalizada.',
  },
  {
    id: '00000000-0000-4000-8000-000000000115',
    codigo: 'matricula.retirada',
    canal: 'app',
    asunto: 'Retiro registrado',
    cuerpo: 'Tu retiro del programa fue registrado.',
  },
  {
    id: '00000000-0000-4000-8000-000000000116',
    codigo: 'matricula.retirada',
    canal: 'email',
    asunto: 'Retiro registrado',
    cuerpo: 'Tu retiro del programa fue registrado.',
  },
  {
    id: '00000000-0000-4000-8000-000000000117',
    codigo: 'horario.modificado',
    canal: 'app',
    asunto: 'Horario actualizado',
    cuerpo: 'El horario de uno de tus grupos fue actualizado.',
  },
  {
    id: '00000000-0000-4000-8000-000000000118',
    codigo: 'horario.modificado',
    canal: 'email',
    asunto: 'Horario actualizado',
    cuerpo: 'El horario de uno de tus grupos fue actualizado.',
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
      '00000000-0000-4000-8000-000000000107',
      '00000000-0000-4000-8000-000000000108',
      '00000000-0000-4000-8000-000000000109',
      '00000000-0000-4000-8000-000000000110',
      '00000000-0000-4000-8000-000000000111',
      '00000000-0000-4000-8000-000000000112',
      '00000000-0000-4000-8000-000000000113',
      '00000000-0000-4000-8000-000000000114',
      '00000000-0000-4000-8000-000000000115',
      '00000000-0000-4000-8000-000000000116',
      '00000000-0000-4000-8000-000000000117',
      '00000000-0000-4000-8000-000000000118'
    )
  `.execute(db);
}
