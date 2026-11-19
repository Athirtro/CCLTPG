import type { Generated } from 'kysely';

/**
 * Tipos de las tablas del esquema `public` (C2).
 *
 * Se declaran a mano junto a las migraciones porque Kysely no genera tipos en
 * este proyecto (D28 code-first). Cualquier cambio de migración debe reflejarse
 * aquí; la prueba de integración de migraciones actúa como red de seguridad.
 */

export type UsuarioEstado = 'activo' | 'inactivo' | 'bloqueado';

export interface UsuarioTable {
  id: string;
  email: string;
  password_hash: string;
  nombre: string;
  estado: UsuarioEstado;
  mfa_habilitado: boolean;
  mfa_secret_cifrado: string | null;
  debe_cambiar_password: Generated<boolean>;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface PerfilTable {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

export interface PermisoTable {
  id: string;
  codigo: string;
  descripcion: string | null;
}

export interface PerfilPermisoTable {
  perfil_id: string;
  permiso_id: string;
}

export interface UsuarioPerfilTable {
  id: string;
  usuario_id: string;
  perfil_id: string;
  valid_until: Date | null;
  asignado_por: string | null;
  creado_en: Generated<Date>;
}

export interface RefreshTokenTable {
  id: string;
  usuario_id: string;
  token_hash: string;
  familia_id: string;
  expira_en: Date;
  revocado_en: Date | null;
  reemplazado_por: string | null;
  ip: string | null;
  user_agent: string | null;
}

export interface CodigoRecuperacionMfaTable {
  id: string;
  usuario_id: string;
  codigo_hash: string;
  usado_en: Date | null;
  creado_en: Generated<Date>;
}

export interface EventoAuditoriaTable {
  id: string;
  actor_id: string | null;
  actor_perfil: string | null;
  ip: string | null;
  dispositivo: string | null;
  recurso: string;
  recurso_id: string | null;
  accion: string;
  datos_antes: unknown;
  datos_despues: unknown;
  ocurrido_en: Generated<Date>;
  request_id: string | null;
}

export interface Database {
  usuario: UsuarioTable;
  perfil: PerfilTable;
  permiso: PermisoTable;
  perfil_permiso: PerfilPermisoTable;
  usuario_perfil: UsuarioPerfilTable;
  refresh_token: RefreshTokenTable;
  codigo_recuperacion_mfa: CodigoRecuperacionMfaTable;
  evento_auditoria: EventoAuditoriaTable;
}
