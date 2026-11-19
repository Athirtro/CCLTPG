import type { PartialScope } from '../../../shared/auth/auth-metadata.js';
import type { RequestContext } from '../../../shared/http/request-context.js';

export type { PartialScope, RequestContext };

export type EstadoUsuario = 'activo' | 'inactivo' | 'bloqueado';

export type MfaMethod = 'totp' | 'recovery';

export type LoginStatus =
  'authenticated' | 'password_change_required' | 'mfa_required' | 'mfa_enrollment_required';

export interface UsuarioSnapshot {
  id: string;
  email: string;
  nombre: string;
  estado: EstadoUsuario;
  passwordHash: string;
  mfaHabilitado: boolean;
  mfaSecretCifrado: string | null;
  debeCambiarPassword: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface PerfilVigente {
  id: string;
  codigo: string;
  nombre: string;
  validUntil: Date | null;
}

export interface UsuarioConPerfiles extends UsuarioSnapshot {
  perfiles: PerfilVigente[];
}

export interface RecoveryCodeRecord {
  id: string;
  hash: string;
}

export interface FullSession {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  expiresIn: number;
  sid: string;
  jti: string;
  refreshExpiresAt: Date;
}

export interface PartialSession {
  sessionToken: string;
  scope: PartialScope;
}

/** Perfiles que obligan a MFA; el estudiante solo si lo inscribe. */
export const MFA_REQUIRED_PROFILES = ['administrador', 'educador'] as const;

/** Forma pública de un perfil en las respuestas de autenticación. */
export interface ProfileSummary {
  codigo: string;
  validUntil: Date | null;
}
