/**
 * Contexto de identidad resuelto por el guard para una solicitud autenticada.
 * No incluye tokens ni secretos: solo lo necesario para autorizar y auditar.
 */

export interface AuthProfile {
  id: string;
  codigo: string;
  nombre: string;
  validUntil: Date | null;
}

export interface AuthGrant {
  profileId: string;
  profileCode: string;
  permissions: string[];
}

export interface AuthPrincipal {
  userId: string;
  sid: string;
  jti: string;
  amr: string[];
  email: string;
  nombre: string;
  estado: 'activo' | 'inactivo' | 'bloqueado';
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  profiles: AuthProfile[];
  /** Permisos expandidos y concretos (sin `*` ni `manage`). */
  permissions: string[];
  /** Permisos por perfil, para atribuir `actor_perfil` (AC-SEC-19). */
  grants: AuthGrant[];
  /** Perfil que otorgó el permiso o el solicitado por `X-Perfil-Activo`. */
  actorProfile: string | null;
  /** Perfil elegido para `/me`; `null` si no hay perfiles vigentes. */
  activeProfile: string | null;
  accessTokenExpiresAt: Date;
}

export interface PartialPrincipal {
  usuarioId: string;
  scope: 'mfa_verify' | 'mfa_enroll' | 'pwd_change';
  /** Token en claro solo durante la petición; nunca se registra. */
  token: string;
}

/**
 * Propiedades que el guard adjunta a la solicitud. Se declaran como tipo
 * explícito en lugar de aumentar el módulo `express` para no depender de la
 * resolución interna de `@types/express-serve-static-core`.
 */
export interface AuthContext {
  auth?: AuthPrincipal;
  authPartial?: PartialPrincipal;
}
