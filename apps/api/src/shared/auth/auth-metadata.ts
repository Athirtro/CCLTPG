import { SetMetadata } from '@nestjs/common';

/**
 * Metadatos de autorización de una operación (R-028 / AC-SEC-16).
 *
 * El guard global aplica **denegación por defecto**: una ruta que no declare
 * ninguno de estos metadatos se rechaza con 403 `PERMISSION_DENIED`.
 */

export type PartialScope = 'mfa_verify' | 'mfa_enroll' | 'pwd_change';

export const REQUIRE_PERMISSIONS_KEY = 'ccltpg:require-permissions';
export const PARTIAL_SCOPES_KEY = 'ccltpg:partial-scopes';
export const AUTHENTICATED_ONLY_KEY = 'ccltpg:authenticated-only';
export const ALLOW_PASSWORD_CHANGE_KEY = 'ccltpg:allow-password-change';
export const ALLOW_ANONYMOUS_KEY = 'ccltpg:allow-anonymous';
export const SKIP_CSRF_KEY = 'ccltpg:skip-csrf';

/** La operación exige al menos uno de los permisos (semántica OR). */
export const RequirePermissions = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);

/**
 * La operación admite un token parcial. Si además se combina con
 * `AuthenticatedOnly`/`RequirePermissions`, también acepta una sesión completa.
 */
export const PartialScopes = (...scopes: PartialScope[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PARTIAL_SCOPES_KEY, scopes);

/** La operación solo exige una sesión válida, sin permiso concreto. */
export const AuthenticatedOnly = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHENTICATED_ONLY_KEY, true);

/** Permite la operación aunque `debe_cambiar_password` esté activo. */
export const AllowPasswordChange = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);

/** Permite ejecutar la operación sin sesión (p. ej. logout idempotente). */
export const AllowAnonymous = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_ANONYMOUS_KEY, true);

/** Exime del doble envío CSRF; solo para flujos sin sesión previa. */
export const SkipCsrf = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_CSRF_KEY, true);
