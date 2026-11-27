import { sql, type Kysely } from 'kysely';
import { v5 as uuidv5 } from 'uuid';

import type { Database } from '../schema.js';

/**
 * Semilla local de datos de negocio de la emisora (§11, decisión I3).
 *
 * No crea perfiles ni permisos: esos viven en `PERMISSION_CATALOG`/
 * `PROFILE_SEEDS` de identidad. Aquí solo se cargan ejemplos de convocatoria,
 * rejilla anual y transmisor. Los UUID son v5 deterministas y los conflictos
 * se resuelven con `doNothing`, así que la semilla puede ejecutarse dos veces.
 */
const NAMESPACE = '7b2e4a61-8c3d-5f09-b1a6-4d7e9c2f0b35';

const idFor = (value: string): string => uuidv5(value, NAMESPACE);

export interface EmisoraSeedResult {
  convocatorias: number;
  rejillas: number;
  franjas: number;
  transmisores: number;
}

export async function seedEmisora(db: Kysely<Database>): Promise<EmisoraSeedResult> {
  const convocatoriaId = idFor('convocatoria:2026');
  const rejillaId = idFor('rejilla:2026');
  const franjaId = idFor('rejilla_item:2026:lunes');
  const transmisorId = idFor('transmisor:RAC-001');

  // 15 enero + 21 días = 5 febrero: plazo de tres semanas (§4.2/§4.4).
  // Literales `date` en SQL: un `Date` de JS se envía con la zona horaria del
  // proceso y puede desplazarse un día al enlazarlo a una columna `date`.
  const fechaApertura = sql<Date>`date '2026-01-15'`;
  const fechaCierre = sql<Date>`date '2026-02-05'`;

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('emisora.convocatoria')
      .values({
        id: convocatoriaId,
        anio: 2026,
        fecha_apertura: fechaApertura,
        fecha_cierre: fechaCierre,
        estado: 'abierta',
        bases_archivo_id: null,
      })
      .onConflict((conflict) => conflict.column('anio').doNothing())
      .execute();

    await trx
      .insertInto('emisora.rejilla_anual')
      .values({
        id: rejillaId,
        anio: 2026,
        comite_id: null,
        estado: 'borrador',
        aprobada_en: null,
      })
      .onConflict((conflict) => conflict.column('anio').doNothing())
      .execute();

    await trx
      .insertInto('emisora.rejilla_anual_item')
      .values({
        id: franjaId,
        rejilla_anual_id: rejillaId,
        fecha: null,
        dia_semana: 1,
        hora_inicio: '06:00',
        hora_fin: '07:00',
        tipo: 'programa',
        programa_id: null,
        nombre: 'Franja de ejemplo',
      })
      .onConflict((conflict) => conflict.column('id').doNothing())
      .execute();

    await trx
      .insertInto('emisora.transmisor')
      .values({
        id: transmisorId,
        codigo: 'RAC-001',
        nombre: 'Emisora Cultural R.A.C.',
        sede: 'Pereira',
        frecuencia: 'FM 107.9',
        activo: true,
        deleted_at: null,
      })
      .onConflict((conflict) => conflict.column('codigo').doNothing())
      .execute();
  });

  return { convocatorias: 1, rejillas: 1, franjas: 1, transmisores: 1 };
}
