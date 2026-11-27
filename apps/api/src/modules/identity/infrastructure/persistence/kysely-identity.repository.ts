import type { Kysely, Transaction } from 'kysely';

import type { Database } from '../../../../database/schema.js';
import type {
  CreateUserInput,
  AssignProfileInput,
  GrantedPermissionRow,
  IdentityRepository,
  UserListFilter,
  UserListRow,
} from '../../application/ports/identity.repository.js';
import type {
  EstadoUsuario,
  PerfilVigente,
  RecoveryCodeRecord,
  UsuarioSnapshot,
} from '../../domain/identity.types.js';

type Executor = Kysely<Database> | Transaction<Database>;

export class KyselyIdentityRepository implements IdentityRepository {
  constructor(private readonly db: Executor) {}

  async findByEmail(email: string): Promise<UsuarioSnapshot | null> {
    const row = await this.db
      .selectFrom('usuario')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();
    return row ? this.mapUser(row) : null;
  }

  async findById(id: string): Promise<UsuarioSnapshot | null> {
    const row = await this.db
      .selectFrom('usuario')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? this.mapUser(row) : null;
  }

  async listProfiles(userId: string, at: Date): Promise<PerfilVigente[]> {
    const rows = await this.db
      .selectFrom('usuario_perfil')
      .innerJoin('perfil', 'perfil.id', 'usuario_perfil.perfil_id')
      .select([
        'perfil.id as id',
        'perfil.codigo as codigo',
        'perfil.nombre as nombre',
        'usuario_perfil.valid_until as valid_until',
      ])
      .where('usuario_perfil.usuario_id', '=', userId)
      .where((expression) =>
        expression.or([
          expression('usuario_perfil.valid_until', 'is', null),
          expression('usuario_perfil.valid_until', '>', at),
        ]),
      )
      .orderBy('perfil.codigo')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      codigo: row.codigo,
      nombre: row.nombre,
      validUntil: row.valid_until,
    }));
  }

  async listGrantedPermissions(perfilIds: readonly string[]): Promise<GrantedPermissionRow[]> {
    if (perfilIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .selectFrom('perfil_permiso')
      .innerJoin('permiso', 'permiso.id', 'perfil_permiso.permiso_id')
      .select(['perfil_permiso.perfil_id as perfil_id', 'permiso.codigo as codigo'])
      .where('perfil_permiso.perfil_id', 'in', [...perfilIds])
      .execute();

    return rows.map((row) => ({ perfilId: row.perfil_id, codigo: row.codigo }));
  }

  async listRecoveryCodes(userId: string): Promise<RecoveryCodeRecord[]> {
    const rows = await this.db
      .selectFrom('codigo_recuperacion_mfa')
      .select(['id', 'codigo_hash'])
      .where('usuario_id', '=', userId)
      .where('usado_en', 'is', null)
      .execute();

    return rows.map((row) => ({ id: row.id, hash: row.codigo_hash }));
  }

  async markRecoveryCodeUsed(id: string, at: Date): Promise<void> {
    await this.db
      .updateTable('codigo_recuperacion_mfa')
      .set({ usado_en: at })
      .where('id', '=', id)
      .where('usado_en', 'is', null)
      .execute();
  }

  async updatePasswordHash(id: string, passwordHash: string, at: Date): Promise<void> {
    await this.db
      .updateTable('usuario')
      .set({ password_hash: passwordHash, actualizado_en: at })
      .where('id', '=', id)
      .execute();
  }

  async updateNombre(id: string, nombre: string, at: Date): Promise<void> {
    await this.db
      .updateTable('usuario')
      .set({ nombre, actualizado_en: at })
      .where('id', '=', id)
      .execute();
  }

  async setMustChangePassword(id: string, value: boolean, at: Date): Promise<void> {
    await this.db
      .updateTable('usuario')
      .set({ debe_cambiar_password: value, actualizado_en: at })
      .where('id', '=', id)
      .execute();
  }

  async setMfaSecretCifrado(id: string, encrypted: string | null, at: Date): Promise<void> {
    await this.db
      .updateTable('usuario')
      .set({ mfa_secret_cifrado: encrypted, actualizado_en: at })
      .where('id', '=', id)
      .execute();
  }

  async enableMfa(id: string, at: Date): Promise<void> {
    await this.db
      .updateTable('usuario')
      .set({ mfa_habilitado: true, actualizado_en: at })
      .where('id', '=', id)
      .execute();
  }

  async disableMfa(id: string, at: Date): Promise<void> {
    await this.db
      .updateTable('usuario')
      .set({ mfa_habilitado: false, actualizado_en: at })
      .where('id', '=', id)
      .execute();
  }

  async replaceRecoveryCodes(
    userId: string,
    codes: readonly { id: string; hash: string }[],
    at: Date,
  ): Promise<void> {
    await this.db.deleteFrom('codigo_recuperacion_mfa').where('usuario_id', '=', userId).execute();

    if (codes.length === 0) {
      return;
    }

    await this.db
      .insertInto('codigo_recuperacion_mfa')
      .values(
        codes.map((code) => ({
          id: code.id,
          usuario_id: userId,
          codigo_hash: code.hash,
          usado_en: null,
          creado_en: at,
        })),
      )
      .execute();
  }

  async deleteRecoveryCodes(userId: string): Promise<void> {
    await this.db.deleteFrom('codigo_recuperacion_mfa').where('usuario_id', '=', userId).execute();
  }

  async setEstado(id: string, estado: EstadoUsuario, at: Date): Promise<void> {
    await this.db
      .updateTable('usuario')
      .set({ estado, actualizado_en: at })
      .where('id', '=', id)
      .execute();
  }

  async listUsers(filter: UserListFilter): Promise<UserListRow[]> {
    let query = this.db
      .selectFrom('usuario')
      .select([
        'id',
        'email',
        'nombre',
        'estado',
        'mfa_habilitado',
        'debe_cambiar_password',
        'creado_en',
        'actualizado_en',
      ])
      .orderBy('creado_en', 'desc')
      .limit(filter.limit)
      .offset(filter.offset);

    if (filter.estado) {
      query = query.where('estado', '=', filter.estado);
    }

    if (filter.search) {
      const term = `%${filter.search}%`;
      query = query.where((expression) =>
        expression.or([expression('email', 'ilike', term), expression('nombre', 'ilike', term)]),
      );
    }

    const rows = await query.execute();
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      nombre: row.nombre,
      estado: row.estado,
      mfaHabilitado: row.mfa_habilitado,
      debeCambiarPassword: row.debe_cambiar_password,
      creadoEn: row.creado_en,
      actualizadoEn: row.actualizado_en,
    }));
  }

  async countUsers(filter: Omit<UserListFilter, 'limit' | 'offset'>): Promise<number> {
    let query = this.db
      .selectFrom('usuario')
      .select((expression) => expression.fn.countAll<string>().as('total'));

    if (filter.estado) {
      query = query.where('estado', '=', filter.estado);
    }

    if (filter.search) {
      const term = `%${filter.search}%`;
      query = query.where((expression) =>
        expression.or([expression('email', 'ilike', term), expression('nombre', 'ilike', term)]),
      );
    }

    const row = await query.executeTakeFirst();
    return Number(row?.total ?? 0);
  }

  async createUser(input: CreateUserInput): Promise<void> {
    await this.db
      .insertInto('usuario')
      .values({
        id: input.id,
        email: input.email,
        password_hash: input.passwordHash,
        nombre: input.nombre,
        estado: input.estado,
        mfa_habilitado: false,
        mfa_secret_cifrado: null,
        debe_cambiar_password: input.debeCambiarPassword,
      })
      .execute();
  }

  async assignProfile(input: AssignProfileInput): Promise<void> {
    await this.db
      .insertInto('usuario_perfil')
      .values({
        id: input.id,
        usuario_id: input.usuarioId,
        perfil_id: input.perfilId,
        valid_until: input.validUntil,
        asignado_por: input.asignadoPor,
      })
      .execute();
  }

  async findPerfilByCodigo(codigo: string): Promise<{ id: string; codigo: string } | null> {
    const row = await this.db
      .selectFrom('perfil')
      .select(['id', 'codigo'])
      .where('codigo', '=', codigo)
      .executeTakeFirst();
    return row ?? null;
  }

  async countActiveProfiles(userId: string, at: Date): Promise<number> {
    const row = await this.db
      .selectFrom('usuario_perfil')
      .select((expression) => expression.fn.countAll<string>().as('total'))
      .where('usuario_id', '=', userId)
      .where((expression) =>
        expression.or([expression('valid_until', 'is', null), expression('valid_until', '>', at)]),
      )
      .executeTakeFirst();
    return Number(row?.total ?? 0);
  }

  private mapUser(row: {
    id: string;
    email: string;
    password_hash: string;
    nombre: string;
    estado: EstadoUsuario;
    mfa_habilitado: boolean;
    mfa_secret_cifrado: string | null;
    debe_cambiar_password: boolean;
    creado_en: Date;
    actualizado_en: Date;
  }): UsuarioSnapshot {
    return {
      id: row.id,
      email: row.email,
      nombre: row.nombre,
      estado: row.estado,
      passwordHash: row.password_hash,
      mfaHabilitado: row.mfa_habilitado,
      mfaSecretCifrado: row.mfa_secret_cifrado,
      debeCambiarPassword: row.debe_cambiar_password,
      creadoEn: row.creado_en,
      actualizadoEn: row.actualizado_en,
    };
  }
}
