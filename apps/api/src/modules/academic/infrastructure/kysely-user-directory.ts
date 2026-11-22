import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../../database/database.module.js';
import type { Database } from '../../../database/schema.js';
import { UserDirectory } from '../application/ports/user-directory.js';

/**
 * Comprueba en `public.usuario` que el educador exista y esté activo. Es una
 * lectura lógica entre contextos: no hay FK ni escritura cruzada.
 */
@Injectable()
export class KyselyUserDirectory implements UserDirectory {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async isActiveEducator(userId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('usuario')
      .select('estado')
      .where('id', '=', userId)
      .executeTakeFirst();
    return row?.estado === 'activo';
  }
}
