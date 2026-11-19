/**
 * Códigos estables de error de autenticación y autorización (`auth-v1` §9).
 * Se congelan en C2: el frontend los usa como clave de traducción.
 */
export const AUTH_ERRORS = {
  invalidCredentials: 'AUTH_INVALID_CREDENTIALS',
  tokenInvalid: 'AUTH_TOKEN_INVALID',
  tokenExpired: 'AUTH_TOKEN_EXPIRED',
  tokenRevoked: 'AUTH_TOKEN_REVOKED',
  tokenReused: 'AUTH_TOKEN_REUSED',
  mfaSessionInvalid: 'AUTH_MFA_SESSION_INVALID',
  mfaInvalidCode: 'AUTH_MFA_INVALID_CODE',
  mfaAttemptsExceeded: 'AUTH_MFA_ATTEMPTS_EXCEEDED',
  mfaAlreadyEnabled: 'AUTH_MFA_ALREADY_ENABLED',
  mfaNotEnabled: 'AUTH_MFA_NOT_ENABLED',
  passwordChangeRequired: 'AUTH_PASSWORD_CHANGE_REQUIRED',
  currentPasswordInvalid: 'AUTH_CURRENT_PASSWORD_INVALID',
  passwordPolicyViolation: 'AUTH_PASSWORD_POLICY_VIOLATION',
  csrfInvalid: 'AUTH_CSRF_INVALID',
  rateLimited: 'AUTH_RATE_LIMITED',
  generalRateLimited: 'RATE_LIMITED',
  activeProfileInvalid: 'ACTIVE_PROFILE_INVALID',
  permissionDenied: 'PERMISSION_DENIED',
  resourceNotFound: 'RESOURCE_NOT_FOUND',
  validationFailed: 'VALIDATION_FAILED',
  conflict: 'CONFLICT',
  serviceUnavailable: 'SERVICE_UNAVAILABLE',
  idempotencyReused: 'IDEMPOTENCY_KEY_REUSED',
} as const;

export type AuthErrorCode = (typeof AUTH_ERRORS)[keyof typeof AUTH_ERRORS];
