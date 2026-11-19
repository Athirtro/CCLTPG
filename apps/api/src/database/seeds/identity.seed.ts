import argon2 from 'argon2';
import type { Kysely } from 'kysely';
import { v5 as uuidv5 } from 'uuid';

import { permissionsFor, PROFILE_SEEDS } from '../../modules/identity/domain/perfiles.js';
import { ARGON2_OPTIONS } from '../../modules/identity/infrastructure/security/argon2-password-hasher.js';
import type { Database } from '../schema.js';

/**
 * Semilla idempotente de identidad (RB1-19).
 *
 * Crea el catálogo cerrado de permisos, los tres perfiles de la gramática v1 y
 * una cuenta administradora inicial con `debe_cambiar_password`. Opcionalmente
 * crea una identidad temporal de ejemplo para ejercitar el ciclo de vida.
 *
 * Los UUID son deterministas (v5) para que volver a ejecutar la semilla no
 * duplique filas. Nunca se ejecuta en producción: `run.ts` lo impide.
 */

const NAMESPACE = '6f1a7d2c-3b4e-5f60-8a1b-2c3d4e5f6071';

export interface SeedOptions {
  /** Contraseña inicial de las cuentas de demostración. */
  password: string;
  /** Correo del administrador inicial. */
  adminEmail?: string;
  /** Crea además una identidad temporal de educador (30 días). */
  withTemporaryIdentity?: boolean;
}

export interface SeedResult {
  perfiles: number;
  permisos: number;
  usuarios: number;
}

const idFor = (value: string): string => uuidv5(value, NAMESPACE);

export async function seedIdentity(
  db: Kysely<Database>,
  options: SeedOptions,
): Promise<SeedResult> {
  const now = new Date();
  const passwordHash = await argon2.hash(options.password, ARGON2_OPTIONS);

  const allPermissions = new Set<string>();
  for (const perfil of PROFILE_SEEDS) {
    for (const permiso of permissionsFor(perfil)) {
      allPermissions.add(permiso);
    }
  }

  await db.transaction().execute(async (trx) => {
    for (const permiso of [...allPermissions].sort()) {
      await trx
        .insertInto('permiso')
        .values({
          id: idFor(`permiso:${permiso}`),
          codigo: permiso,
          descripcion: null,
        })
        .onConflict((conflict) => conflict.column('codigo').doNothing())
        .execute();
    }

    for (const perfil of PROFILE_SEEDS) {
      const perfilId = idFor(`perfil:${perfil.codigo}`);
      await trx
        .insertInto('perfil')
        .values({
          id: perfilId,
          codigo: perfil.codigo,
          nombre: perfil.nombre,
          descripcion: perfil.descripcion,
        })
        .onConflict((conflict) => conflict.column('codigo').doNothing())
        .execute();

      for (const permiso of permissionsFor(perfil)) {
        await trx
          .insertInto('perfil_permiso')
          .values({
            perfil_id: perfilId,
            permiso_id: idFor(`permiso:${permiso}`),
          })
          .onConflict((conflict) => conflict.columns(['perfil_id', 'permiso_id']).doNothing())
          .execute();
      }
    }

    const adminEmail = (options.adminEmail ?? 'admin@ccltpg.org').trim().toLowerCase();
    const adminId = idFor(`usuario:${adminEmail}`);

    await trx
      .insertInto('usuario')
      .values({
        id: adminId,
        email: adminEmail,
        password_hash: passwordHash,
        nombre: 'Administrador inicial',
        estado: 'activo',
        mfa_habilitado: false,
        mfa_secret_cifrado: null,
        debe_cambiar_password: true,
      })
      .onConflict((conflict) => conflict.column('email').doNothing())
      .execute();

    await trx
      .insertInto('usuario_perfil')
      .values({
        id: idFor(`usuario_perfil:${adminEmail}:administrador`),
        usuario_id: adminId,
        perfil_id: idFor('perfil:administrador'),
        valid_until: null,
        asignado_por: null,
      })
      .onConflict((conflict) => conflict.column('id').doNothing())
      .execute();

    if (options.withTemporaryIdentity) {
      const temporalEmail = 'temporal@ccltpg.org';
      const temporalId = idFor(`usuario:${temporalEmail}`);

      await trx
        .insertInto('usuario')
        .values({
          id: temporalId,
          email: temporalEmail,
          password_hash: passwordHash,
          nombre: 'Identidad temporal de ejemplo',
          estado: 'activo',
          mfa_habilitado: false,
          mfa_secret_cifrado: null,
          debe_cambiar_password: true,
        })
        .onConflict((conflict) => conflict.column('email').doNothing())
        .execute();

      await trx
        .insertInto('usuario_perfil')
        .values({
          id: idFor(`usuario_perfil:${temporalEmail}:educador`),
          usuario_id: temporalId,
          perfil_id: idFor('perfil:educador'),
          valid_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          asignado_por: adminId,
        })
        .onConflict((conflict) => conflict.column('id').doNothing())
        .execute();
    }
  });

  return {
    perfiles: PROFILE_SEEDS.length,
    permisos: allPermissions.size,
    usuarios: options.withTemporaryIdentity ? 2 : 1,
  };
}
