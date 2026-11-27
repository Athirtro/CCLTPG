import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../../database/database.module.js';
import type { Database } from '../../../database/schema.js';
import {
  FORMACION_DIRECTORY,
  type FormacionDirectory,
  type FormacionFormadorRef,
  type FormacionInscripcionRef,
  type FormacionProgramaRef,
} from '../../../shared/integration/formacion-directory.port.js';

/**
 * Directorio público de formación (plan §2.2). Proveedor nuevo y aditivo:
 * expone solo lecturas de los agregados que ya existen en `academic`, sin
 * modificar casos de uso ni repositorios del contexto.
 */
@Injectable()
export class KyselyFormacionDirectory implements FormacionDirectory {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async listProgramas(): Promise<readonly FormacionProgramaRef[]> {
    return this.db
      .selectFrom('academic.programa_formativo')
      .select(['id', 'nombre', 'area', 'estado'])
      .execute();
  }

  async listFormadores(programaId: string): Promise<readonly FormacionFormadorRef[]> {
    const rows = await this.db
      .selectFrom('academic.grupo as g')
      .innerJoin('usuario as u', 'u.id', 'g.educador_id')
      .select(['u.id as formador_id', 'u.nombre', 'u.email'])
      .where('g.programa_id', '=', programaId)
      .distinct()
      .execute();

    return rows.map((row) => ({
      id: row.formador_id,
      nombre: row.nombre,
      email: row.email,
    }));
  }

  async listInscripciones(programaId: string): Promise<readonly FormacionInscripcionRef[]> {
    const rows = await this.db
      .selectFrom('academic.matricula as m')
      .innerJoin('academic.grupo as g', 'g.id', 'm.grupo_id')
      .select(['m.id', 'm.estudiante_id', 'm.estado', 'm.periodo'])
      .where('g.programa_id', '=', programaId)
      .execute();

    return rows.map((row) => ({
      id: row.id,
      programaId,
      estudianteId: row.estudiante_id,
      estado: row.estado,
      periodo: row.periodo,
    }));
  }
}

export const FORMATION_DIRECTORY_PROVIDER = {
  provide: FORMACION_DIRECTORY,
  useClass: KyselyFormacionDirectory,
};
