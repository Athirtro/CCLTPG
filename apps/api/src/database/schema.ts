import type { Generated } from 'kysely';

/**
 * Tipos de las tablas del esquema `public` (C2–C3).
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

export type ArchivoEstadoEscaneo = 'pendiente' | 'limpio' | 'infectado';

export interface ArchivoTable {
  id: string;
  nombre_original: string;
  mime: string;
  tamano: number;
  hash_sha256: string;
  ruta_objeto: string;
  subido_por: string;
  estado_escaneo: Generated<ArchivoEstadoEscaneo>;
  creado_en: Generated<Date>;
}

export type NotificacionCanal = 'app' | 'email';
export type NotificacionEstado = 'pendiente' | 'enviada' | 'leida' | 'fallida';

export interface PlantillaNotificacionTable {
  id: string;
  codigo: string;
  canal: NotificacionCanal;
  asunto: string;
  cuerpo: string;
  version: Generated<number>;
  creado_en: Generated<Date>;
}

export interface NotificacionTable {
  id: string;
  usuario_id: string;
  evento: string;
  evento_id: string | null;
  canal: NotificacionCanal;
  plantilla_id: string | null;
  payload: unknown;
  estado: Generated<NotificacionEstado>;
  leida_en: Date | null;
  enviada_en: Date | null;
  creado_en: Generated<Date>;
}

export interface PreferenciaNotificacionTable {
  id: string;
  usuario_id: string;
  evento: string;
  canal: NotificacionCanal;
  habilitado: Generated<boolean>;
  actualizado_en: Generated<Date>;
}

export type IdempotencyEstado = 'en_proceso' | 'completada';

export interface IdempotencyKeyTable {
  id: string;
  usuario_id: string;
  operacion: string;
  clave: string;
  hash_solicitud: string;
  estado: Generated<IdempotencyEstado>;
  respuesta_status: number | null;
  respuesta_cuerpo: unknown;
  creado_en: Generated<Date>;
  expira_en: Date;
}

export type OutboxEstado = 'pendiente' | 'procesando' | 'procesada' | 'fallida';

export interface EventoOutboxTable {
  id: string;
  agregado: string;
  tipo: string;
  payload: unknown;
  estado: Generated<OutboxEstado>;
  intentos: Generated<number>;
  disponible_en: Generated<Date>;
  creado_en: Generated<Date>;
  procesado_en: Date | null;
  ultimo_error: string | null;
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
  archivo: ArchivoTable;
  plantilla_notificacion: PlantillaNotificacionTable;
  notificacion: NotificacionTable;
  preferencia_notificacion: PreferenciaNotificacionTable;
  idempotency_key: IdempotencyKeyTable;
  evento_outbox: EventoOutboxTable;
}
