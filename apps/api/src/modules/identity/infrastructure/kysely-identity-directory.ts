import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../../database/database.module.js';
import type { Database } from '../../../database/schema.js';
import {
  IDENTITY_DIRECTORY,
  type IdentityDirectory,
  type IdentityUserRef,
} from '../../../shared/integration/identity-directory.port.js';

/**
 * Directorio público de identidad (plan §2.2, I4). Proveedor nuevo y aditivo:
 * resuelve usuarios, perfiles y vigencia desde el esquema `public`, que es de
 * propiedad de este contexto. Emisora consume solo el puerto compartido.
 */
@Injectable()
export class KyselyIdentityDirectory implements IdentityDirectory {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async findById(id: string): Promise<IdentityUserRef | null> {
    return this.findBy('id', id);
  }

  async findByEmail(email: string): Promise<IdentityUserRef | null> {
    return this.findBy('email', email);
  }

  async hasActiveProfile(
    usuarioId: string,
    codigo: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const row = await this.db
      .selectFrom('usuario_perfil')
      .innerJoin('perfil', 'perfil.id', 'usuario_perfil.perfil_id')
      .innerJoin('usuario', 'usuario.id', 'usuario_perfil.usuario_id')
      .select('usuario_perfil.id')
      .where('usuario_perfil.usuario_id', '=', usuarioId)
      .where('perfil.codigo', '=', codigo)
      .where('usuario.estado', '=', 'activo')
      .where((eb) =>
        eb.or([
          eb('usuario_perfil.valid_until', 'is', null),
          eb('usuario_perfil.valid_until', '>', now),
        ]),
      )
      .executeTakeFirst();

    return row !== undefined;
  }

  private async findBy(column: 'id' | 'email', value: string): Promise<IdentityUserRef | null> {
    const base =
      column === 'id'
        ? this.db.selectFrom('usuario').where('usuario.id', '=', value)
        : this.db.selectFrom('usuario').where('usuario.email', '=', value);

    const rows = await base
      .leftJoin('usuario_perfil', 'usuario_perfil.usuario_id', 'usuario.id')
      .leftJoin('perfil', 'perfil.id', 'usuario_perfil.perfil_id')
      .select([
        'usuario.id as usuario_id',
        'usuario.email',
        'usuario.nombre',
        'usuario.estado',
        'perfil.codigo as perfil_codigo',
        'usuario_perfil.valid_until',
      ])
      .execute();

    if (rows.length === 0) {
      return null;
    }

    const first = rows[0];
    const perfiles = rows.flatMap((row) =>
      row.perfil_codigo === null
        ? []
        : [{ codigo: row.perfil_codigo, validUntil: row.valid_until }],
    );

    return {
      id: first.usuario_id,
      email: first.email,
      nombre: first.nombre,
      estado: first.estado,
      perfiles,
    };
  }
}

export const IDENTITY_DIRECTORY_PROVIDER = {
  provide: IDENTITY_DIRECTORY,
  useClass: KyselyIdentityDirectory,
};
