import { MFA_REQUIRED_PROFILES, type LoginStatus, type PerfilVigente } from './identity.types.js';

/**
 * MFA obligatorio si el usuario tiene un perfil que lo exige o una identidad
 * temporal (asignación con `valid_until`, diseño §9).
 */
export function requiresMfa(profiles: readonly PerfilVigente[]): boolean {
  return profiles.some(
    (profile) =>
      (MFA_REQUIRED_PROFILES as readonly string[]).includes(profile.codigo) ||
      profile.validUntil !== null,
  );
}

/**
 * Máquina de estados del login (`auth-v1` §3). El orden importa:
 * cambio de contraseña → inscripción MFA → verificación MFA → sesión completa.
 */
export function decideLoginStatus(input: {
  mustChangePassword: boolean;
  mfaRequired: boolean;
  mfaEnabled: boolean;
}): LoginStatus {
  if (input.mustChangePassword) {
    return 'password_change_required';
  }

  if (input.mfaRequired && !input.mfaEnabled) {
    return 'mfa_enrollment_required';
  }

  if (input.mfaEnabled) {
    return 'mfa_required';
  }

  return 'authenticated';
}
